document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: {tabId: tabs[0].id},
        function: collectWebArtifacts,
      },
      async (results) => {
        const {fonts, colors, images, externalCSSLinks} = results[0].result

        const fontList = parseFonts(fonts)
        document.getElementById('fonts').querySelector('div').innerHTML = fontList.join(', ')

        const colorArticles = parseColors(colors)
        document.getElementById('colors').querySelector('div').innerHTML = colorArticles.join('')

        const imageElements = parseImages(images)
        document.getElementById('images').querySelector('div').innerHTML = imageElements.join('')

        // Fetch and parse the CSS files
        const parsedCSS = await fetchAndParseCSSFiles(externalCSSLinks)
        const animationsAndTransitions = extractAnimationsAndTransitions(parsedCSS)
        document.getElementById('animations').querySelector('div').innerHTML = animationsAndTransitions.join('')
      },
    )
  })
})

function collectWebArtifacts() {
  const fontFamilies = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily)))

  const textColors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).color)))
  const backgroundColors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).backgroundColor)))
  const combinedColors = [...textColors, ...backgroundColors]

  // Collecting all image src attributes
  const imageSources = Array.from(document.querySelectorAll('img')).map((img) => img.src)

  // Collecting external CSS files (link elements with rel="stylesheet")
  const externalCSSLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href)

  return {fonts: fontFamilies, colors: combinedColors, images: imageSources, externalCSSLinks}
}

async function fetchAndParseCSSFiles(cssLinks) {
  const parsedCSS = {}

  for (const link of cssLinks) {
    try {
      // Fetch the CSS file
      const response = await fetch(link)
      if (!response.ok) {
        console.error(`Failed to fetch ${link}:`, response.status)
        continue
      }

      // Get the CSS text
      const cssText = await response.text()

      // Store the CSS text
      parsedCSS[link] = cssText
    } catch (error) {
      console.error(`Error fetching ${link}:`, error)
    }
  }

  return parsedCSS
}

function extractAnimationsAndTransitions(parsedCSS) {
  const animationsAndTransitions = []

  for (const [link, cssText] of Object.entries(parsedCSS)) {
    const rules = cssText
      .split('}')
      .map((rule) => rule.trim())
      .filter((rule) => rule)

    for (const rule of rules) {
      const parts = rule.split('{')
      if (parts.length < 2) continue // Skip if there is no styles

      const selector = parts[0].trim()
      const styles = parts[1].trim()

      // Check for animations and transitions
      const animationMatch = styles.match(/animation:[^;]*;/)
      const transitionMatch = styles.match(/transition:[^;]*;/)

      if (animationMatch || transitionMatch) {
        const animationDetails = `
          <div class="animation-item">
            <h4>${selector}</h4>
            <p>${animationMatch ? `<strong>Animation:</strong> ${animationMatch[0].replace(';', '')}` : ''}</p>
            <p>${transitionMatch ? `<strong>Transition:</strong> ${transitionMatch[0].replace(';', '')}` : ''}</p>
            <p><em>from <mark>${link}</mark></em></p>
          </div>`
        animationsAndTransitions.push(animationDetails)
      }
    }
  }

  return animationsAndTransitions
}

function parseImages(images) {
  return images.map((src) => {
    return `
      <a href="${src}" target="_blank" rel="noopener noreferrer">
        <img src="${src}" style="max-width: 100%; margin-bottom: 10px;" />
      </a>`
  })
}

function parseFonts(fonts) {
  return fonts.map((font) => font.split(',').map((f) => f.trim())).flat()
}

function parseColors(colors) {
  function isLightColor(color) {
    const rgb = color.match(/\d+/g).map(Number)
    const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
    return luminance > 0.5
  }

  return colors.map((color) => {
    return `<article style="background-color: ${color}; color: ${isLightColor(color) ? '#000' : '#fff'};">
              <p>${color}</p>
            </article>`
  })
}
