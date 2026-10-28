import {test, expect} from '../../support/fixtures'
import {createProjects} from './prepareProjects'
import {updateUserSettings} from '../../support/updateUserSettings'

test.describe('Home project overview', () => {
	test('shows every active root project even before it has been visited', async ({authenticatedPage: page}) => {
		const projects = await createProjects(6)
		await page.goto('/')
		const grid = page.getByTestId('projectCardGrid')
		await expect(grid.locator('.project-grid-item')).toHaveCount(6)
		await grid.getByRole('link', {name: projects[0].title, exact: true}).click()
		await expect(page).toHaveURL(/projects\/1\//)
		await page.goto('/')
		await page.reload()
		await expect(grid.locator('.project-grid-item')).toHaveCount(6)
		await expect(page.getByRole('heading', {name: 'Last viewed'})).toHaveCount(0)
	})

	test('does not hide project cards when the legacy history preference is disabled', async ({authenticatedPage: page, apiContext, userToken}) => {
		await createProjects(6)
		await updateUserSettings(apiContext, userToken, {frontend_settings: {show_last_viewed: false}})
		await page.goto('/')
		await expect(page.getByTestId('projectCardGrid').locator('.project-grid-item')).toHaveCount(6)
	})
})
