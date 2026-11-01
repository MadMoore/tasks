import {computed, toValue, type MaybeRefOrGetter} from 'vue'
import {useQuery} from '@tanstack/vue-query'
import {tasksQuery, type TaskScope} from '@/client/queries/tasks'

export type UseTasksOptions = {
	enabled?: MaybeRefOrGetter<boolean>
	page?: MaybeRefOrGetter<number>
	refetchInterval?: MaybeRefOrGetter<number | false>
}

export function useTasks(
	scope: MaybeRefOrGetter<TaskScope>,
	{enabled = true, page = 1, refetchInterval = false}: UseTasksOptions = {},
) {
	const query = useQuery(computed(() => ({
		...tasksQuery(toValue(scope), toValue(page)),
		enabled: toValue(enabled),
		refetchInterval: toValue(refetchInterval),
	})))
	const tasks = computed(() => query.data.value?.items ?? [])
	const total = computed(() => query.data.value?.total ?? 0)
	const totalPages = computed(() => query.data.value?.total_pages ?? 0)
	return {...query, tasks, total, totalPages}
}
