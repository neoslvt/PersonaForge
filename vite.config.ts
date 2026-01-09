import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Custom plugin to handle image saving API
function imageApiPlugin(): Plugin {
  return {
    name: 'image-api',
    configureServer(server) {
      // API endpoint to save images
      server.middlewares.use('/api/save-image', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        try {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', async () => {
            try {
              const { filename, data } = JSON.parse(body)
              
              if (!filename || !data) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing filename or data' }))
                return
              }

              // Ensure images directory exists
              const imagesDir = path.join(process.cwd(), 'images')
              if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true })
              }

              // Convert base64 data to buffer
              const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
              const buffer = Buffer.from(base64Data, 'base64')

              // Save file
              const filePath = path.join(imagesDir, filename)
              fs.writeFileSync(filePath, buffer)

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, path: `images/${filename}` }))
            } catch (error) {
              console.error('Error saving image:', error)
              res.statusCode = 500
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
            }
          })
        } catch (error) {
          console.error('Error in save-image middleware:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })

      // API endpoint to check if image exists
      server.middlewares.use('/api/check-image', (req, res, next) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`)
          const filename = url.searchParams.get('filename')
          
          if (!filename) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing filename parameter' }))
            return
          }

          const filePath = path.join(process.cwd(), 'images', filename)
          const exists = fs.existsSync(filePath)

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ exists }))
        } catch (error) {
          console.error('Error checking image:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })

      // API endpoint to read image
      server.middlewares.use('/api/read-image', (req, res, next) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`)
          const filename = url.searchParams.get('filename')
          
          if (!filename) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing filename parameter' }))
            return
          }

          const filePath = path.join(process.cwd(), 'images', filename)
          
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'File not found' }))
            return
          }

          const buffer = fs.readFileSync(filePath)
          const base64 = buffer.toString('base64')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ data: `data:image/png;base64,${base64}` }))
        } catch (error) {
          console.error('Error reading image:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), imageApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
  },
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
})

