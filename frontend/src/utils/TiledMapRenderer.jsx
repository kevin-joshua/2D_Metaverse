import { useRef, useEffect, useState } from "react"


export default function TiledMapRenderer({ mapData }) {
  const canvasRef = useRef(null)
  const [renderComplete, setRenderComplete] = useState(false)

  // Render a simple colored grid
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tileWidth = mapData.tilewidth;
    const tileHeight = mapData.tileheight;
    const tilesetImage = new Image();
    tilesetImage.src = tilemapSrc; // Load tilemap image

    tilesetImage.onload = () => {
      ctx.fillStyle = "#333"; // Background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const layer = mapData.layers[0];
      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const tileIndex = y * layer.width + x;
          const tileId = layer.data[tileIndex];

          if (tileId > 0) {
            const tilesPerRow = tilesetImage.width / tileWidth;
            const sx = (tileId % tilesPerRow) * tileWidth;
            const sy = Math.floor(tileId / tilesPerRow) * tileHeight;

            ctx.drawImage(
              tilesetImage,
              sx, sy, tileWidth, tileHeight, // Source (tile position in tileset)
              x * tileWidth, y * tileHeight, tileWidth, tileHeight // Destination (canvas position)
            );
          }
        }
      }
      setRenderComplete(true);
    };
  }, [mapData, tilemapSrc]);

  // Fixed canvas size for testing
  const canvasWidth = mapData.width * mapData.tilewidth
  const canvasHeight = mapData.height * mapData.tileheight

  console.log("Rendering canvas with dimensions:", canvasWidth, canvasHeight)

  return (
    <div className="relative bg-gray-800 p-4">
      <canvas ref={canvasRef} width={mapData.width * mapData.tilewidth} height={mapData.height * mapData.tileheight} className="border border-gray-600" />
      {!renderComplete && <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">Rendering map...</div>}
    </div>
  )
}

