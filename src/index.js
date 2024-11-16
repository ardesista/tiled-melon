//import polybool from '@velipso/polybool';
//import { decomp, makeCCW, quickDecomp } from 'poly-decomp-es'

tiled.registerMapFormat("tiled_melon", {
  name: "MelonJS map file",
  extension: "json",

  write: function(map, fileName) {
    function addProperties(mapObject, target) {
      let properties = typeof(mapObject.properties) == "function" ? mapObject.properties() : mapObject.properties;

      if(properties) {
        if(Object.keys(properties).length > 0 && !target.properties)
          target.properties = {};

        for(let k in properties)
          target.properties[k] = properties[k];
      }

      return target;
    }

    function getCenter(ob) {
      const a = 0.017453292519943295 * ob.rotation;
      const w2 = .5 * ob.width;
      const h2 = .5 * ob.height;
      return {
        x: ob.x + w2 * Math.cos(a) - h2 * Math.sin(a),
        y: ob.y + h2 * Math.cos(a) + w2 * Math.sin(a)
      };
    }

    let tileWidth = map.tileWidth;
    let tileHeight = map.tileHeight;
    let nextLayerId = Math.max.apply(undefined, map.layers.map((l) => l.id)) + 1;
    let nextObjectId = 1;
    let collisionLayer = null;
    for(let i = 0; i < map.layerCount; i++) {
      let layer = map.layerAt(i);
      if(layer.isObjectLayer) {
        nextObjectId = Math.max(nextObjectId, 1 + Math.max.apply(undefined, layer.objects.map((ob) => ob.id)));
        if(layer.name.toLowerCase().includes("collision"))
          collisionLayer = layer;
      }
    }

    let firstGids = {};
    let nextGid = 0;
    for(let t of map.tilesets) {
      firstGids[t] = nextGid + 1;
      nextGid += t.nextTileId;
    }

    let collisionObjects = [];
    for(let i = 0; i < map.layerCount; i++) {
      let layer = map.layerAt(i);
      if(layer.isTileLayer) {
        for(let y = 0; y < layer.height; y++) {
          for(let x = 0; x < layer.width; x++) {
            let t = layer.tileAt(x, y);
            if(!t || !t.objectGroup)
              continue;
            
            const flags = layer.flagsAt(x, y);
            for(let ob of t.objectGroup.objects) {
              if(ob.x === undefined || ob.y === undefined || ob.width === undefined || ob.width <= 0 || ob.height === undefined || ob.height <= 0)
                continue;

              let obx = ob.x, oby = ob.y;
              let width = ob.width, height = ob.height;
              if(flags & Tile.FlippedAntiDiagonally) {
                let t = width;
                width = height;
                height = t;
                t = obx;
                obx = oby;
                oby = t;
              }
              if(((flags & Tile.FlippedHorizontally) && !(flags & Tile.FlippedAntiDiagonally)) || (flags & (Tile.FlippedVertically | Tile.FlippedAntiDiagonally))) {
                obx = tileWidth - obx - width;
              }
              if(((flags & Tile.FlippedVertically) && !(flags & Tile.FlippedAntiDiagonally)) || (flags & (Tile.FlippedHorizontally | Tile.FlippedAntiDiagonally))) {
                oby = tileHeight - oby - height;
              }

              collisionObjects.push({
                id: nextObjectId++,
                x: x * tileWidth + obx,
                y: y * tileHeight + oby,
                width: width,
                height: height
              });
            }
          }
        }
      }
      else if(layer.isObjectLayer) {
        for(let ob of layer.objects) {
          if(!ob.tile || !ob.tile.objectGroup)
            continue;

          for(let shape of ob.tile.objectGroup.objects) {
            if(shape.x === undefined || shape.y === undefined || shape.width === undefined || shape.height === undefined)
              continue;

            collisionObjects.push({
              id: nextObjectId++,
              rotation: ob.rotation,
              x: ob.x + shape.x,
              y: ob.y + shape.y,
              width: shape.width,
              height: shape.height
            });
          }
        }
      }
    }

    let layers = [];
    if(!collisionLayer) {
      layers.push({
        id: nextLayerId++,
        draworder: "topdown",
        type: "objectgroup",
        name: "Collision",
        visible: true,
        opacity: 1.0,
        x: 0,
        y: 0,
        objects: collisionObjects
      });
    }

    for(let i = 0; i < map.layerCount; i++) {
      let layer = map.layerAt(i);
      if(layer.isTileLayer) {
        let data = [];
        for(let y = 0; y < layer.height; y++) {
            for(let x = 0; x < layer.width; x++) {
              const tile = layer.tileAt(x, y);
              let id = 0;

              if(tile) {
                const flags = layer.flagsAt(x, y);

                id = tile.id + firstGids[tile.tileset];
                if(flags & Tile.FlippedAntiDiagonally)
                  id |= 0x20000000;
                if(flags & Tile.FlippedVertically)
                  id |= 0x40000000;
                if(flags & Tile.FlippedHorizontally)
                  id |= 0x80000000;
              }

              data.push(id);
            }
        }

        layers.push(addProperties(layer, {
          id: layer.id,
          type: "tilelayer",
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          x: layer.offset.x,
          y: layer.offset.y,
          width: layer.width,
          height: layer.height,
          data: data
        }));
      }
      else if(layer.isObjectLayer) {
        let objects = [];
        for(let ob of layer.objects) {
          const c = getCenter(ob);
          let y = {
            id: ob.id,
            name: ob.name,
            rotation: ob.rotation,
            type: ob.className,
            visible: ob.visible,
            x: c.x,
            y: c.y,
            width: ob.width,
            height: ob.height
          };

          if(ob.polygon && ob.polygon.length >= 3) {
            y.polygon = ob.polygon.map((p) => { return { x: p.x, y: p.y }; });
          }

          if(ob.tile) {
            y.gid = ob.tile.id + firstGids[ob.tile.tileset];
            addProperties(ob.tile, y);
          }

          objects.push(addProperties(ob, y));
        }

        if(collisionLayer && layer == collisionLayer)
          objects.push(...collisionObjects);

        layers.push(addProperties(layer, {
          id: layer.id,
          draworder: "manual",
          type: "objectgroup",
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          x: layer.offset.x,
          y: layer.offset.y,
          objects: objects
        }));
      }
    }

    let file = new TextFile(fileName, TextFile.WriteOnly);
    file.write(JSON.stringify(addProperties(map, {
      compressionlevel: -1,
      tilewidth: tileWidth,
      tileheight: tileHeight,
      infinite: map.infinite,
      width: map.width,
      height: map.height,
      layers: layers,
      nextlayerid: nextLayerId,
      nextobjectid: nextObjectId,
      orientation: "orthogonal",
      renderorder: "right-down",
      tiledversion: tiled.version,
      tilesets: map.tilesets.map((t) => {
        return {
          firstgid: firstGids[t],
          source: t.fileName.substring(t.fileName.lastIndexOf('/') + 1)
        };
      }),
      type: "map",
      version:"1.10",
    })));
    file.commit();
  }
});
