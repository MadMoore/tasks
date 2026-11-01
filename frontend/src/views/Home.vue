<template>
	<div class="content has-text-centered">
		<h1 v-if="salutation">
			{{ salutation }}
		</h1>

		<Message
			v-if="deletionScheduledAt !== null"
			variant="danger"
			class="mbe-4"
		>
			{{
				$t('user.deletion.scheduled', {
					date: formatDisplayDate(deletionScheduledAt),
					dateSince: formatDateSince(deletionScheduledAt),
				})
			}}
			<RouterLink :to="{name: 'user.settings.deletion'}">
				{{ $t('user.deletion.scheduledCancel') }}
			</RouterLink>
		</Message>
		<HomeSearch class="is-max-width-desktop" />
		<ShowTasks
			v-if="projectList.hasProjects"
			focus
			:label-ids="labelIds"
			class="show-tasks"
			@clearLabelFilter="handleClearLabelFilter"
		/>
		<section
			v-if="projectList.notArchivedRootProjects.length > 0"
			class="home-projects has-text-start"
			aria-labelledby="home-projects-title"
		>
			<h2 id="home-projects-title">
				{{ $t('project.projects') }}
			</h2>
			<ProjectCardGrid
				v-cy="'projectCardGrid'"
				:projects="projectList.notArchivedRootProjects"
				overview-layout
			/>
		</section>
	</div>
</template>

<script lang="ts" setup>
import {computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'

import Message from '@/components/misc/Message.vue'
import ShowTasks from '@/views/tasks/ShowTasks.vue'
import ProjectCardGrid from '@/components/project/partials/ProjectCardGrid.vue'
import HomeSearch from '@/components/home/HomeSearch.vue'

import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {parseQuickAddPrefill, QUICK_ADD_PREFILL_PARAMS} from '@/helpers/quickAddPrefill'
import {formatDateSince, formatDisplayDate} from '@/helpers/time/formatDate'
import {useDaytimeSalutation} from '@/composables/useDaytimeSalutation'

import {useProjects} from '@/composables/useProjects'
import {useAuthStore} from '@/stores/auth'
import {useBaseStore} from '@/stores/base'

const salutation = useDaytimeSalutation()

const authStore = useAuthStore()
const projectList = useProjects()
const route = useRoute()
const router = useRouter()
const baseStore = useBaseStore()

watch(() => route.query, query => {
	const prefill = parseQuickAddPrefill(query)
	if (prefill === null) {
		return
	}
	baseStore.setQuickActionsActive(true, prefill)
	// Stripped so a reload doesn't open the dialog again.
	const rest = {...query}
	QUICK_ADD_PREFILL_PARAMS.forEach(param => delete rest[param])
	router.replace({name: 'home', query: rest})
}, {immediate: true})

const deletionScheduledAt = computed(() => parseDateOrNull(authStore.info?.deletion_scheduled_at))

// Extract label IDs from query parameter
const labelIds = computed(() => {
	const labelsParam = route.query.labels
	if (!labelsParam) {
		return undefined
	}
	return Array.isArray(labelsParam) ? labelsParam.filter((id): id is string => id !== null) : [labelsParam]
})

function handleClearLabelFilter() {
	const query = {...route.query}
	delete query.labels
	router.push({
		name: route.name as string,
		query,
	})
}
</script>

<style scoped lang="scss">
.show-tasks,
.home-projects {
	margin-block-start: 2rem;
}
</style>
