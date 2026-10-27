<script setup lang="ts">
import {computed, ref} from 'vue'
import {refDebounced} from '@vueuse/core'
import Icon from '@/components/misc/Icon'
import Message from '@/components/misc/Message.vue'
import {useTasks} from '@/composables/useTasks'
import {useProjects} from '@/composables/useProjects'
import {useAuthStore} from '@/stores/auth'

const input = ref('')
const search = refDebounced(input, 300)
const term = computed(() => search.value.trim())
const auth = useAuthStore()
const projects = useProjects()
const taskQuery = useTasks(
	() => ({
		params: {
			q: term.value,
			per_page: 10,
			sort_by: ['priority', 'id'],
			order_by: ['desc', 'desc'],
		},
	}),
	{enabled: () => auth.authenticated && term.value.length > 0},
)
const matchingProjects = computed(() => projects.searchProject(term.value).slice(0, 10))
const showResults = computed(() => term.value.length > 0 && term.value === input.value.trim())
</script>

<template>
	<div class="home-search">
		<form
			role="search"
			@submit.prevent
		>
			<div class="control has-icons-left">
				<input
					v-model="input"
					v-cy="'homeSearch'"
					type="search"
					class="input"
					:placeholder="$t('filters.query.placeholder')"
					:aria-label="$t('keyboardShortcuts.quickSearch')"
				>
				<span
					class="icon is-left"
					aria-hidden="true"
				><Icon icon="search" /></span>
			</div>
		</form>
		<div
			v-if="showResults"
			v-cy="'homeSearchResults'"
			class="search-results has-text-start"
			:aria-busy="taskQuery.isFetching.value"
		>
			<Message
				v-if="taskQuery.isError.value"
				variant="danger"
			>
				{{ $t('error.error') }}
			</Message>
			<p role="status">
				{{ $t('quickActions.results', matchingProjects.length + taskQuery.total.value) }}
			</p>
			<template v-if="matchingProjects.length">
				<h3>{{ $t('quickActions.projects') }}</h3>
				<ul>
					<li
						v-for="project in matchingProjects"
						:key="project.id"
					>
						<RouterLink :to="{name: 'project.index', params: {projectId: project.id}}">
							{{ project.title }}
						</RouterLink>
					</li>
				</ul>
			</template>
			<template v-if="taskQuery.tasks.value.length">
				<h3>{{ $t('quickActions.tasks') }}</h3>
				<ul>
					<li
						v-for="task in taskQuery.tasks.value"
						:key="task.id"
					>
						<RouterLink :to="{name: 'task.detail', params: {taskId: task.id}}">
							{{ task.title }}
						</RouterLink>
					</li>
				</ul>
			</template>
		</div>
	</div>
</template>

<style lang="scss" scoped>
.home-search .input {
	min-block-size: 3rem;
}

.search-results {
	margin-block-start: 1rem;
	padding: 1rem;
	border: 1px solid var(--grey-200);
	border-radius: $radius;
	background: var(--white);
}
</style>
