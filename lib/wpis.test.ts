import { describe, expect, it } from 'vitest'
import { linkWpisu, zakladkaZAdresu } from '@/lib/wpis'

describe('linkWpisu', () => {
  it('zakładka i edycja do poprawy w adresie', () => {
    expect(linkWpisu('rekrutacja')).toBe('/analytics/wpis?tab=rekrutacja')
    expect(linkWpisu('kohorta', "J'25")).toBe('/analytics/wpis?tab=kohorta&edycja=J%2725')
  })
  it('nieznana albo pusta zakładka to rekrutacja', () => {
    expect(zakladkaZAdresu('kohorta')).toBe('kohorta')
    expect(zakladkaZAdresu('cokolwiek')).toBe('rekrutacja')
    expect(zakladkaZAdresu(null)).toBe('rekrutacja')
  })
})
