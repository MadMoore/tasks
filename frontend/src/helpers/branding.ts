// vue-i18n loads JIT message ASTs as well as plain strings. Rebrand their
// content without changing translation keys, links or upstream attribution.
export function brandMessages<T>(value: T, key = ''): T {
	if (key === 'poweredBy') return value
	if (typeof value === 'string') return value.replace(/\bVikunja\b/g, 'Tasks') as T
	if (Array.isArray(value)) return value.map(item => brandMessages(item)) as T
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, brandMessages(item, name)])) as T
	}
	return value
}
