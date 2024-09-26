document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: {tabId: tabs[0].id},
        function: collectWebArtifacts,
      },
      async (results) => {
        const {fonts, colors, images, externalCSSLinks, inlineSVGs, svgImages} = results[0].result

        const fontList = parseFonts(fonts)
        document.getElementById('fonts').querySelector('div').innerHTML = fontList.join(', ')

        const colorArticles = parseColors(colors)
        document.getElementById('colors').querySelector('div').innerHTML = colorArticles.join('')

        const imageElements = parseImages(images)
        document.getElementById('images').querySelector('div').innerHTML = imageElements.join('')

        const parsedCSS = await fetchAndParseCSSFiles(externalCSSLinks)
        const animationsAndTransitions = extractAnimationsAndTransitions(parsedCSS)
        document.getElementById('animations').querySelector('div').innerHTML = animationsAndTransitions.join('')

        const svgIcons = parseSVGs(inlineSVGs, svgImages)
        document.getElementById('icons').querySelector('div').innerHTML = svgIcons.join('')
      },
    )
  })
})

function collectWebArtifacts() {
  const fontFamilies = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily)))

  const textColors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).color)))
  const backgroundColors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).backgroundColor)))
  const combinedColors = [...textColors, ...backgroundColors]

  const imageSources = Array.from(document.querySelectorAll('img')).map((img) => img.src)

  const externalCSSLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href)

  const inlineSVGs = Array.from(document.querySelectorAll('svg')).map((svg) => svg.outerHTML)

  const svgImages = Array.from(document.querySelectorAll('img[src$=".svg"]')).map((img) => img.src)

  return {
    fonts: fontFamilies,
    colors: combinedColors,
    images: imageSources,
    externalCSSLinks,
    inlineSVGs,
    svgImages,
  }
}

function parseSVGs(inlineSVGs, svgImages) {
  const inlineSVGElements = inlineSVGs.map((svg, index) => {
    const blob = new Blob([svg], {type: 'image/svg+xml'})
    const url = URL.createObjectURL(blob)

    return `
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        <div class="svg-icon">${svg}</div>
      </a>`
  })

  const svgImageElements = svgImages.map((src) => {
    return `
      <a href="${src}" target="_blank" rel="noopener noreferrer">
        <img src="${src}" style="max-width: 100%; margin-bottom: 10px;" />
      </a>`
  })

  return [...inlineSVGElements, ...svgImageElements]
}

async function fetchAndParseCSSFiles(cssLinks) {
  const parsedCSS = {}

  for (const link of cssLinks) {
    try {
      const response = await fetch(link)
      if (!response.ok) {
        console.error(`Failed to fetch ${link}:`, response.status)
        continue
      }

      const cssText = await response.text()

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
      if (parts.length < 2) continue

      const selector = parts[0].trim()
      const styles = parts[1].trim()

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
