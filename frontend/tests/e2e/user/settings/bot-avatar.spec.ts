import {fileURLToPath} from 'node:url'
import {test, expect} from '../../../support/fixtures'
import {gotoUserSettings} from '../../../support/userSettings'
import {ProjectFactory} from '../../../factories/project'
import {TaskFactory} from '../../../factories/task'
import {TaskCommentFactory} from '../../../factories/task_comment'

test('uploads and replaces a bot photo, including existing comments after reload', async ({authenticatedPage: page, apiContext, userToken}, testInfo) => {
	const headers = {Authorization: `Bearer ${userToken}`}
	const created = await apiContext.post('/api/v2/user/bots', {headers, data: {username: 'bot-photo', name: 'Photo assistant'}})
	expect(created.ok()).toBe(true)
	const bot = await created.json()
	await ProjectFactory.create(1)
	await TaskFactory.create(1)
	await TaskCommentFactory.create(1, {author_id: bot.id, comment: '<p>A comment from the assistant</p>'})
	await gotoUserSettings(page, 'bots')
	const card = page.locator('.bot-card')
	const image = card.locator('img.bot-avatar')
	await expect(image).toBeVisible()
	for (const filename of ['image-blue.png', 'image.jpg']) {
		const before = await image.getAttribute('src')
		const uploaded = page.waitForResponse(r => r.url().includes('/api/v2/user/settings/avatar?owner_id=') && r.request().method() === 'PUT')
		await card.getByLabel('Upload Avatar').setInputFiles(fileURLToPath(new URL(`../../../fixtures/${filename}`, import.meta.url)))
		expect((await uploaded).status()).toBe(200)
		await expect(image).not.toHaveAttribute('src', before!)
		await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
	}
	await page.reload()
	await expect(image).toBeVisible()
	await page.screenshot({path: testInfo.outputPath('bot-avatar-settings.png'), fullPage: true})
	const expected = await apiContext.get(`/api/v2/avatar/${bot.username}?size=48`, {headers})
	expect(expected.ok()).toBe(true)
	const expectedBytes = [...await expected.body()]
	await page.goto('/tasks/1')
	const comment = page.locator('.comment').filter({hasText: 'A comment from the assistant'})
	await expect(comment).toContainText('Photo assistant')
	const photo = comment.locator('figure img')
	await expect(photo).toBeVisible()
	await expect.poll(() => photo.evaluate(async (img: HTMLImageElement) => [...new Uint8Array(await (await fetch(img.src)).arrayBuffer())])).toEqual(expectedBytes)
	await page.reload()
	await expect(photo).toBeVisible()
	await page.screenshot({path: testInfo.outputPath('bot-avatar-comment.png'), fullPage: true})
})
