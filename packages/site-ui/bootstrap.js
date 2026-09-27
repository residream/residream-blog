;(() => {
  if (window.ResidreamUI) return
  const modes = ['system', 'dark', 'light']
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  let sessionPreference = 'system'
  function shared() {
    try {
      const cookie = document.cookie.split('; ').find((item) => item.startsWith('residream-theme='))
      const value = cookie?.slice('residream-theme='.length)
      if (modes.includes(value)) return value
    } catch {}
  }
  function stored() {
    try {
      const saved = localStorage.getItem('theme')
      if (modes.includes(saved)) return saved
    } catch {}
  }
  function share(preference) {
    const sharedDomain =
      location.hostname === 'residream.com' || location.hostname.endsWith('.residream.com')
    try {
      document.cookie = `residream-theme=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${sharedDomain ? '; Domain=residream.com' : ''}${location.protocol === 'https:' ? '; Secure' : ''}`
    } catch {}
  }
  function read() {
    return shared() || stored() || sessionPreference
  }
  function setTheme(preference = read(), save = false) {
    const root = document.documentElement
    if (!modes.includes(preference)) preference = 'system'
    sessionPreference = preference
    const resolved = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference
    root.dataset.themePref = preference
    root.dataset.rdTheme = resolved
    root.classList.toggle('dark', resolved === 'dark')
    root.dataset.mantineColorScheme = resolved
    document.querySelectorAll('[data-rd-theme-toggle]').forEach((button) => {
      button.dataset.theme = preference
    })
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0B0B10' : '#FCFCFD')
    if (save) {
      try {
        localStorage.setItem('theme', preference)
      } catch {}
      share(preference)
    }
    document.dispatchEvent(new CustomEvent('rd-theme-change', { detail: { preference, resolved } }))
    return preference
  }
  window.ResidreamUI = {
    read,
    setTheme,
    next: () => setTheme(modes[(modes.indexOf(read()) + 1) % modes.length], true)
  }
  // A theme saved before the shared cookie existed is shared once, so the other sites follow it
  if (!shared() && stored()) share(stored())
  setTheme()
  system.addEventListener('change', () => setTheme())
  window.addEventListener('storage', (event) => {
    if (event.key === 'theme') setTheme()
  })
  window.addEventListener('pageshow', () => setTheme())
  window.addEventListener('focus', () => setTheme())
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTheme()
  })
})()
