document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: {tabId: tabs[0].id},
        function: collectWebArtifacts,
      },
      (results) => {
        const {fonts, colors} = results[0].result

        document.getElementById('fonts').querySelector('div').innerHTML = `${fonts.join(', ')}`
        document.getElementById('colors').querySelector('div').innerHTML = `${colors.join(', ')}`
      },
    )
  })
})

function collectWebArtifacts() {
  const fonts = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily)))
  const colors = Array.from(new Set([...document.querySelectorAll('*')].map((el) => getComputedStyle(el).color)))

  return {fonts, colors}
}
