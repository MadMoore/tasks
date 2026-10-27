import {test, expect} from '../../support/fixtures'
import {ProjectFactory} from '../../factories/project'
import {TaskFactory} from '../../factories/task'
import {SavedFilterFactory} from '../../factories/saved_filter'
import {createDefaultViews} from '../project/prepareProjects'
import {updateUserSettings} from '../../support/updateUserSettings'
import {apiV1Url} from '../../support/apiUrl'

async function prepareFocus() {
	const projects = await ProjectFactory.create(6, {title: i => `Project ${i}`})
	for (const [index, project] of projects.entries()) {
		await createDefaultViews(project.id, index * 4 + 1)
	}
	const past = new Date(Date.now() - 3_600_000).toISOString()
	const future = new Date(Date.now() + 86_400_000).toISOString()
	const priorities = [1, 5, 2, 4, 0, 3, 1, 2]
	await TaskFactory.create(8, {
		title: i => `Focus ${i}`,
		project_id: i => projects[(i - 1) % 6].id,
		start_date: past,
		due_date: future,
		priority: i => priorities[i - 1],
	})
	await TaskFactory.create(1, {
		id: 20, title: 'Future start', project_id: projects[0].id,
		start_date: future, due_date: past, priority: 5,
	}, false)
	await TaskFactory.create(1, {
		id: 21, title: 'No start', project_id: projects[0].id, priority: 5,
	}, false)
	await TaskFactory.create(1, {
		id: 22, title: 'Zero start', project_id: projects[0].id,
		start_date: '1970-01-01T00:00:00Z', priority: 5,
	}, false)
	await TaskFactory.create(1, {
		id: 23, title: 'Completed', project_id: projects[0].id,
		start_date: past, priority: 5, done: true,
	}, false)
	return projects
}

const focusRows = '[data-cy="showTasks"] .tasks > li'

test.describe('Home focus', () => {
	test('shows five started open tasks by priority, independently of saved home filters', async ({authenticatedPage: page, apiContext, userToken}) => {
		await prepareFocus()
		await SavedFilterFactory.create(1, {
			filters: JSON.stringify({filter: 'id = 999999', filter_include_nulls: false}),
		})
		await updateUserSettings(apiContext, userToken, {
			frontend_settings: {filter_id_used_on_overview: -2},
		})
		await page.goto('/')
		await expect(page.locator(focusRows)).toHaveCount(5)
		await expect(page.locator(`${focusRows} .task-link`)).toHaveText(['Focus 2', 'Focus 4', 'Focus 6', 'Focus 8', 'Focus 3'])
		await page.reload()
		await expect(page.locator(`${focusRows} .task-link`)).toHaveText(['Focus 2', 'Focus 4', 'Focus 6', 'Focus 8', 'Focus 3'])
		for (const excluded of ['Future start', 'No start', 'Zero start', 'Completed']) {
			await expect(page.getByTestId('showTasks')).not.toContainText(excluded)
		}
	})

	test('completing a focus task persists and fills the available slot', async ({authenticatedPage: page, apiContext, userToken}) => {
		await prepareFocus()
		await page.goto('/')
		await expect(page.locator(focusRows)).toHaveCount(5)
		await page.locator(focusRows).first().locator('.fancy-checkbox label').click()
		await expect(page.locator(`${focusRows} .task-link`)).toHaveText(['Focus 4', 'Focus 6', 'Focus 8', 'Focus 3', 'Focus 7'])
		await page.reload()
		await expect(page.locator(`${focusRows} .task-link`)).toHaveText(['Focus 4', 'Focus 6', 'Focus 8', 'Focus 3', 'Focus 7'])
		const response = await apiContext.get(`${apiV1Url().replace('/v1', '/v2')}/tasks/2`, {
			headers: {Authorization: `Bearer ${userToken}`},
		})
		expect(response.ok()).toBeTruthy()
		expect((await response.json()).done).toBe(true)
	})

	test('search finds tasks outside focus and projects without creating a task', async ({authenticatedPage: page, apiContext, userToken}, testInfo) => {
		await prepareFocus()
		await page.goto('/')
		await expect(page.locator(focusRows)).toHaveCount(5)
		const mutations: string[] = []
		page.on('request', request => {
			if (request.method() === 'POST' && /\/projects\/\d+\/tasks(?:\/bulk)?$/.test(new URL(request.url()).pathname)) mutations.push(request.url())
		})
		const search = page.getByTestId('homeSearch')
		await expect(page.locator('.add-task-textarea')).toHaveCount(0)
		await search.fill('Future start')
		await search.press('Enter')
		await expect(page.getByTestId('homeSearchResults').getByRole('link', {name: 'Future start', exact: true})).toBeVisible()
		await page.screenshot({path: testInfo.outputPath('home-search.png'), fullPage: true})
		await page.getByTestId('homeSearchResults').getByRole('link', {name: 'Future start', exact: true}).click()
		await expect(page).toHaveURL(/\/tasks\/20$/)
		await page.goto('/')
		await search.fill('Project 6')
		await expect(page.getByTestId('homeSearchResults').getByRole('link', {name: 'Project 6', exact: true})).toBeVisible()
		await search.fill('unmatched search words')
		await expect(page.getByTestId('homeSearchResults')).toBeVisible()
		await expect(page.getByTestId('homeSearchResults').getByRole('status')).toHaveText('No results')
		await expect(page.getByTestId('homeSearchResults').getByRole('link')).toHaveCount(0)
		await search.fill('')
		await expect(page.getByTestId('homeSearchResults')).toHaveCount(0)
		expect(mutations).toEqual([])
		const response = await apiContext.get(`${apiV1Url().replace('/v1', '/v2')}/tasks?per_page=50`, {
			headers: {Authorization: `Bearer ${userToken}`},
		})
		expect(response.ok()).toBeTruthy()
		expect((await response.json()).total).toBe(12)
	})

	for (const screen of [
		{name: 'desktop', width: 1440, columns: 6},
		{name: 'tablet', width: 900, columns: 3},
		{name: 'mobile', width: 390, columns: 2},
	]) {
		test(`keeps all six project cards below focus on ${screen.name}`, async ({authenticatedPage: page}, testInfo) => {
			await prepareFocus()
			await ProjectFactory.create(1, {id: 7, title: 'Archived', is_archived: true}, false)
			await page.setViewportSize({width: screen.width, height: 1000})
			await page.goto('/')
			const grid = page.getByTestId('projectCardGrid')
			await expect(grid.locator('.project-grid-item')).toHaveCount(6)
			await expect.poll(() => grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(screen.columns)
			await expect(page.locator(focusRows)).toHaveCount(5)
			const cards = await grid.boundingBox()
			const focus = await page.getByTestId('showTasks').boundingBox()
			expect(cards!.y).toBeGreaterThan(focus!.y + focus!.height)
			await page.screenshot({path: testInfo.outputPath(`home-${screen.name}.png`), fullPage: true})
		})
	}
})
