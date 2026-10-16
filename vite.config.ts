import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Commit actual leido de .git sin usar el comando git (la imagen de Node del build no lo trae).
 * HEAD apunta a una rama (refs/heads/...) o es un commit (detached); la rama puede estar en packed-refs.
 */
function commitActual(): string | undefined {
  try {
    const head = readFileSync('.git/HEAD', 'utf8').trim()
    if (!head.startsWith('ref: ')) return head.slice(0, 7)
    const ref = head.slice(5)
    if (existsSync(`.git/${ref}`)) return readFileSync(`.git/${ref}`, 'utf8').trim().slice(0, 7)
    const packed = readFileSync('.git/packed-refs', 'utf8')
      .split('\n')
      .find((linea) => linea.endsWith(` ${ref}`))
    return packed?.slice(0, 7)
  } catch {
    return undefined
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    // Version mostrada en el pie del panel
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
    __APP_COMMIT__: JSON.stringify(process.env.VITE_COMMIT || commitActual() || 'desconocido'),
    __APP_BUILD__: JSON.stringify(command === 'build' ? new Date().toISOString() : null),
  },
}))
