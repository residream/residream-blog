;(() => {
  if (customElements.get('rd-header')) return
  class SiteHeader extends HTMLElement {
    connectedCallback() {
      window.ResidreamUI?.setTheme()
      this.controller?.abort()
      this.controller = new AbortController()
      const options = { signal: this.controller.signal }
      let previous = window.scrollY
      const menu = (open) => {
        this.classList.toggle('rd-expanded', open)
        this.querySelector('[data-rd-menu-toggle]')?.setAttribute('aria-expanded', String(open))
      }
      this.addEventListener(
        'click',
        (event) => {
          const target = event.target instanceof Element ? event.target : null
          if (target?.closest('[data-rd-theme-toggle]')) {
            const preference = window.ResidreamUI.next()
            document.dispatchEvent(
              new CustomEvent('toast', { detail: { message: `Set theme to ${preference}` } })
            )
          } else if (target?.closest('[data-rd-menu-toggle]'))
            menu(!this.classList.contains('rd-expanded'))
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
          if (event.key === 'Escape' && this.classList.contains('rd-expanded')) {
            menu(false)
            this.querySelector('[data-rd-menu-toggle]')?.focus()
          }
        },
        options
      )
      const scroll = () => {
        const current = window.scrollY
        this.classList.toggle('rd-scrolled', current > 20)
        this.classList.toggle('rd-hidden', current >= 350 && current > previous)
        previous = current
      }
      window.addEventListener('scroll', scroll, { ...options, passive: true })
      window.addEventListener(
        'resize',
        () => {
          if (window.innerWidth >= 640) menu(false)
        },
        options
      )
      if (previous > 20) scroll()
    }
    disconnectedCallback() {
      this.controller?.abort()
    }
  }
  customElements.define('rd-header', SiteHeader)
  document.addEventListener('toast', (event) => {
    const toast = document.createElement('div')
    toast.className = 'rd-toast'
    toast.setAttribute('role', 'status')
    const icon = document.querySelector('template[data-rd-toast-icon]')
    if (icon) toast.append(icon.content.cloneNode(true))
    const message = document.createElement('span')
    message.textContent = String(event.detail?.message || '')
    toast.append(message)
    document.body.append(toast)
    setTimeout(() => toast.remove(), event.detail?.time || 3000)
  })
})()
