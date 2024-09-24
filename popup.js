document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: {tabId: tabs[0].id},
        function: collectWebArtifacts,
      },
      (results) => {
        const {fonts, colors} = results[0].result

        const fontList = parseFonts(fonts)
        document.getElementById('fonts').querySelector('div').innerHTML = fontList.join(', ')

        const colorArticles = parseColors(colors)
        document.getElementById('colors').querySelector('div').innerHTML = colorArticles.join('')
      },
    )
  })
})

function collectWebArtifacts() {
  const fonts = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily)))
  const colors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).color)))

  return {fonts, colors}
}

function parseFonts(fonts) {
  // const fallbackFonts = ['ui-sans-serif', '-apple-system', 'system-ui', 'sans-serif', 'monospace', 'serif']
  return fonts.map((font) => font.split(',').map((f) => f.trim())).flat()
  // .filter((font) => !fallbackFonts.includes(font))
}

function parseColors(colors) {
  return colors.map((color) => {
    return `<article style="background-color: ${color}; color: ${isLightColor(color) ? '#000' : '#fff'};">
              <p>${color}</p>
            </article>`
  })
}

function isLightColor(color) {
  const rgb = color.match(/\d+/g).map(Number)

  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return luminance > 0.5
}
