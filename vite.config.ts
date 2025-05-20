import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import {
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from "fs"
import { build } from "esbuild"

async function buildExtensionScript(inputFile: string, outputFile: string) {
  try {
    await build({
      entryPoints: [inputFile],
      bundle: true,
      outfile: outputFile,
      format: "esm",
      platform: "browser",
      target: "es2020",
      minify: process.env.NODE_ENV === "production",
    })
    console.log(`Successfully built ${outputFile}`)
  } catch (error) {
    console.error(`Error building ${inputFile}:`, error)
  }
}

async function buildBackgroundScripts() {
  try {
    // Create output directory
    mkdirSync("dist/background", { recursive: true })
    mkdirSync("dist/background/handlers", { recursive: true })

    // Build main background script
    await buildExtensionScript(
      "src/background/index.ts",
      "dist/background/index.js"
    )

    console.log("Successfully built background scripts")
  } catch (error) {
    console.error("Error building background scripts:", error)
  }
}

function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    async closeBundle() {
      // Create icons directory if it doesn't exist
      if (!existsSync("public/icons")) {
        mkdirSync("public/icons", { recursive: true })
      }

      // Copy manifest to dist
      copyFileSync("manifest.json", "dist/manifest.json")

      // Build content script from TypeScript to JavaScript
      await buildExtensionScript("src/content.ts", "dist/content.js")

      // Build background scripts with new structure
      await buildBackgroundScripts()

      // Ensure dist/icons directory exists
      mkdirSync("dist/icons", { recursive: true })

      // Simply copy existing icons or create placeholder files
      const sizes = [16, 48, 128]
      sizes.forEach((size) => {
        const iconPath = `public/icons/icon${size}.png`
        const targetPath = `dist/icons/icon${size}.png`

        if (existsSync(iconPath)) {
          // Copy existing icon
          copyFileSync(iconPath, targetPath)
        } else {
          // Create a simple placeholder file instead of trying to generate an image
          console.log(
            `Icon ${iconPath} not found. Creating a placeholder file.`
          )
          // Write a simple 1x1 blue PNG as placeholder (hardcoded minimal PNG)
          const minimumPNG = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
            0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63,
            0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd,
            0x8d, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82,
          ])
          writeFileSync(iconPath, minimumPNG)
          copyFileSync(iconPath, targetPath)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), copyExtensionAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
})
