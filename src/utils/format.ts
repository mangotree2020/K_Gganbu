export function formatDate(dateString: string, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString))
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return `${formatDate(startDate)} ~ ${formatDate(endDate)} (${diffDays}박 ${diffDays + 1}일)`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num)
}
