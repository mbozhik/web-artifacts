document.addEventListener('DOMContentLoaded', () => {
  const inspectButton = document.getElementById('inspectButton')
  let isInspecting = false

  inspectButton.addEventListener('click', () => {
    isInspecting = !isInspecting

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (isInspecting) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: startInspecting,
        })
        inspectButton.textContent = 'Deactivate Element Inspector'
      } else {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: stopInspecting,
        })
        inspectButton.textContent = 'Activate Element Inspector'
      }
    })
  })

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

function startInspecting() {
  const style = document.createElement('style')
  style.innerHTML = `
    .highlight {
      outline: 2px solid red !important;
      position: relative;
    }
    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      font-size: 12px;
      padding: 5px;
      border-radius: 4px;
      white-space: nowrap;
      z-index: 9999;
    }
  `
  document.head.appendChild(style)

  let previousElement = null
  let tooltip = null

  function clearPreviousHighlight() {
    if (previousElement) {
      previousElement.classList.remove('highlight')
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
    }
  }

  function showElementStyles(element) {
    clearPreviousHighlight()

    previousElement = element
    previousElement.classList.add('highlight')

    const styles = window.getComputedStyle(element)
    const font = styles.fontFamily
    const color = styles.color
    const bgColor = styles.backgroundColor

    tooltip = document.createElement('div')
    tooltip.className = 'tooltip'
    tooltip.innerHTML = `
      <p><strong>Font:</strong> ${font}</p>
      <p><strong>Color:</strong> ${color}</p>
      <p><strong>Background:</strong> ${bgColor}</p>
    `

    const rect = element.getBoundingClientRect()
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 5}px`
    tooltip.style.left = `${rect.left + window.scrollX}px`

    document.body.appendChild(tooltip)
  }

  function debounce(func, delay) {
    let timeout
    return function (...args) {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), delay)
    }
  }

  const debouncedShowElementStyles = debounce(showElementStyles, 100)

  document.addEventListener('mouseover', (event) => {
    const element = event.target
    debouncedShowElementStyles(element)
  })

  document.addEventListener('click', (event) => {
    event.preventDefault()
    clearPreviousHighlight()
    console.log('Element inspection mode deactivated!')
  })
}

function stopInspecting() {
  document.removeEventListener('mouseover', handleMouseOver)
  document.removeEventListener('click', handleMouseClick)

  document.querySelectorAll('.highlight').forEach((element) => {
    element.classList.remove('highlight')
  })

  if (tooltip) {
    tooltip.remove()
    tooltip = null
  }

  const injectedStyle = document.querySelector('style')
  if (injectedStyle) {
    injectedStyle.remove()
  }
}

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
