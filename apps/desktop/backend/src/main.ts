import * as Neutralino from '@neutralinojs/lib'

Neutralino.init()

// Window close is handled by the React shell (stops the API server before exit).

window.platform = Neutralino

if (window.NL_PORT) {
    const root = document.getElementById('app')

    const p = document.createElement('p')

    p.innerText = `NL_PORT: ${window.NL_PORT}`
    root?.appendChild(p)
}
