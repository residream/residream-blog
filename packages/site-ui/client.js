;(() => {
  if (customElements.get('rd-header')) return
  // The new theme spreads in a circle from the toggle where view transitions are available
  function switchTheme(origin) {
    const apply = () => {
      const preference = window.ResidreamUI.next()
      document.dispatchEvent(
        new CustomEvent('toast', { detail: { message: `Set theme to ${preference}` } })
      )
    }
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches)
      return apply()
    const { left, top, width, height } = origin.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    // For this transition only: no cross-fade, and the header is revealed with the page
    const style = document.createElement('style')
    style.textContent =
      '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}' +
      'rd-header{view-transition-name:none!important}'
    document.head.append(style)
    const transition = document.startViewTransition(apply)
    transition.ready
      .then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 350, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
        )
      )
      .catch(() => {})
    transition.finished.catch(() => {}).then(() => style.remove())
  }
  class SiteHeader extends HTMLElement {
    connectedCallback() {
      window.ResidreamUI?.setTheme()
      this.controller?.abort()
      this.controller = new AbortController()
      const options = { signal: this.controller.signal }
      let previous = window.scrollY
      this.classList.toggle('not-top', previous > 20)
      this.dataset.show = 'true'
      const menu = (open) => {
        this.classList.toggle('expanded', open)
        this.querySelector('[data-rd-menu-toggle]')?.setAttribute('aria-expanded', String(open))
      }
      this.addEventListener(
        'click',
        (event) => {
          const target = event.target instanceof Element ? event.target : null
          const themeToggle = target?.closest('[data-rd-theme-toggle]')
          if (themeToggle) switchTheme(themeToggle)
          else if (target?.closest('[data-rd-menu-toggle]'))
            menu(!this.classList.contains('expanded'))
          else if (target?.closest('a')) menu(false)
        },
        options
      )
      document.addEventListener(
        'click',
        (event) => {
          if (!this.contains(event.target)) menu(false)
        },
        options
      )
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape' && this.classList.contains('expanded')) {
            menu(false)
            this.querySelector('[data-rd-menu-toggle]')?.focus()
          }
        },
        options
      )
      const scroll = () => {
        const current = window.scrollY
        if (current === previous) return
        this.classList.toggle('not-top', current > 20)
        // Assigning an unchanged value still records a DOM mutation
        const show = String(current < 350 || current < previous)
        if (this.dataset.show !== show) this.dataset.show = show
        previous = current
      }
      window.addEventListener('scroll', scroll, { ...options, passive: true })
      window.addEventListener(
        'rd:scroll-restored',
        () => {
          previous = window.scrollY
          this.classList.toggle('not-top', previous > 20)
          this.dataset.show = 'true'
        },
        options
      )
      window.addEventListener(
        'resize',
        () => {
          if (window.innerWidth >= 640) menu(false)
        },
        options
      )
    }
    disconnectedCallback() {
      this.controller?.abort()
    }
  }
  customElements.define('rd-header', SiteHeader)
  let currentToast = null
  document.addEventListener('toast', (event) => {
    // A new message replaces the visible one instead of stacking on top of it
    currentToast?.remove()
    const toast = document.createElement('div')
    toast.setAttribute('role', 'status')
    const icon = document.querySelector('template[data-rd-toast-icon]')
    toast.className = icon?.getAttribute('data-rd-toast-class') || ''
    if (icon) toast.append(icon.content.cloneNode(true))
    const message = document.createElement('span')
    message.textContent = String(event.detail?.message || '')
    toast.append(message)
    document.body.append(toast)
    currentToast = toast
    setTimeout(() => {
      const done = () => {
        toast.remove()
        if (currentToast === toast) currentToast = null
      }
      if (!toast.isConnected || !toast.animate) return done()
      // Animated from script, so the sub-sites need no extra CSS for it
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      toast
        .animate(
          [{ opacity: 1 }, { opacity: 0, transform: still ? 'none' : 'translateY(0.5rem)' }],
          { duration: 200, easing: 'ease-in', fill: 'forwards' }
        )
        .finished.then(done, done)
    }, event.detail?.time || 3000)
  })
})()
