import { describe, it, expect } from 'vitest'
import { seleccionarPrompt } from '@/lib/chat-auris-prompts'

// Auditoría 2026-10-08 §4 y paso 7: el chat no debe prometer lo que Centinela no tiene.
describe('prompts de AURIS', () => {
  it('el prompt público no promete funciones inexistentes', () => {
    const p = seleccionarPrompt(undefined).toLowerCase()
    for (const falso of ['rtsp', 'onvif', 'facial', 'face recognition', 'sms', '30 días', 'app móvil nativa', '1-3 días']) {
      expect(p, `no debe mencionar "${falso}"`).not.toContain(falso)
    }
  })

  it('el prompt público describe el enlace real con Raspberry Pi y ESP32', () => {
    const p = seleccionarPrompt(undefined)
    expect(p).toContain('Raspberry Pi')
    expect(p).toContain('ESP32')
  })

  it('el prompt de Usuario reconoce que el Admin asigna reportes a un Operador', () => {
    const p = seleccionarPrompt('Usuario')
    expect(p).not.toContain('no es una función disponible hoy')
    expect(p).toMatch(/Admin puede asignar/)
  })

  it('cada rol recibe su prompt', () => {
    expect(seleccionarPrompt('Admin')).toBe(seleccionarPrompt('Operador'))
    expect(seleccionarPrompt('Usuario')).not.toBe(seleccionarPrompt(undefined))
  })
})
