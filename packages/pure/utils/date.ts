import config from 'virtual:config'

const dateFormat = new Intl.DateTimeFormat(config.locale.dateLocale, config.locale.dateOptions)

export function getFormattedDate(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
  locale: string = config.locale.dateLocale
) {
  if (typeof options !== 'undefined' || locale !== config.locale.dateLocale) {
    return new Date(date).toLocaleDateString(locale, {
      ...(config.locale.dateOptions as Intl.DateTimeFormatOptions),
      ...options
    })
  }

  return dateFormat.format(new Date(date))
}
