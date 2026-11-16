import {describe, expect, it} from 'vitest'
import {brandMessages} from './branding'

describe('Tasks message branding', () => {
	it('handles compiled locale ASTs and preserves attribution and message keys', () => {
		const messages = {
			welcome: {t: 0, b: {t: 2, i: [{t: 3}], s: 'Bienvenido a Vikunja'}},
			poweredBy: {t: 0, b: {s: 'Powered by Vikunja'}},
			vikunja: 'Vikunja',
			link: 'https://vikunja.io/',
		}
		expect(brandMessages(messages)).toEqual({
			welcome: {t: 0, b: {t: 2, i: [{t: 3}], s: 'Bienvenido a Tasks'}},
			poweredBy: messages.poweredBy,
			vikunja: 'Tasks',
			link: messages.link,
		})
		expect(messages.welcome.b.s).toBe('Bienvenido a Vikunja')
	})
})
