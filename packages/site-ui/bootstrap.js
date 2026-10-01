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
  // Every attribute write is a DOM mutation, so unchanged values are skipped
  function set(element, key, value) {
    if (element.dataset[key] !== value) element.dataset[key] = value
  }
  // Elements with color transitions would otherwise change after the page background
  function withoutTransitions(apply) {
    const pause = document.createElement('style')
    pause.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.append(pause)
    apply()
    // Settle the new colors while transitions are off, then restore them
    void document.body.offsetHeight
    requestAnimationFrame(() => pause.remove())
  }
  function setTheme(preference = read(), save = false) {
    const root = document.documentElement
    if (!modes.includes(preference)) preference = 'system'
    sessionPreference = preference
    const resolved = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference
    const apply = () => {
      set(root, 'themePref', preference)
      set(root, 'rdTheme', resolved)
      root.classList.toggle('dark', resolved === 'dark')
      set(root, 'mantineColorScheme', resolved)
    }
    if (document.body && root.dataset.rdTheme && root.dataset.rdTheme !== resolved)
      withoutTransitions(apply)
    else apply()
    document.querySelectorAll('[data-rd-theme-toggle]').forEach((button) => {
      set(button, 'theme', preference)
    })
    const color = resolved === 'dark' ? '#0B0B10' : '#FCFCFD'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta && meta.getAttribute('content') !== color) meta.setAttribute('content', color)
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
