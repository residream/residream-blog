;(() => {
  if (customElements.get('rd-header')) return
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
          if (target?.closest('[data-rd-theme-toggle]')) {
            const preference = window.ResidreamUI.next()
            document.dispatchEvent(
              new CustomEvent('toast', { detail: { message: `Set theme to ${preference}` } })
            )
          } else if (target?.closest('[data-rd-menu-toggle]'))
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
        this.dataset.show = String(current < 350 || current < previous)
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
  document.addEventListener('toast', (event) => {
    const toast = document.createElement('div')
    toast.setAttribute('role', 'status')
    const icon = document.querySelector('template[data-rd-toast-icon]')
    toast.className = icon?.getAttribute('data-rd-toast-class') || ''
    if (icon) toast.append(icon.content.cloneNode(true))
    const message = document.createElement('span')
    message.textContent = String(event.detail?.message || '')
    toast.append(message)
    document.body.append(toast)
    setTimeout(() => toast.remove(), event.detail?.time || 3000)
  })
})()
