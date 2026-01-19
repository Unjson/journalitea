<script lang="ts" setup>
const props = defineProps<{
	modelValue: boolean;
	title?: string;
	message?: string;
	confirmText?: string;
	cancelText?: string;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'confirm'): void;
	(e: 'cancel'): void;
}>();

const close = () => emit('update:modelValue', false);

const onCancel = () => {
	emit('cancel');
	close();
};

const onConfirm = () => {
	emit('confirm');
	close();
};
</script>

<template>
	<teleport to="body">
		<div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
			<div class="absolute inset-0 bg-black/50" @click="onCancel"></div>
			<div class="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-lg p-6">
				<h3 class="text-lg font-semibold mb-2">
					{{ title ?? 'Confirm' }}
				</h3>
				<p class="text-sm text-gray-600 dark:text-gray-300 mb-6">
					{{ message ?? 'Are you sure?' }}
				</p>
				<div class="flex justify-end gap-3">
					<button
						class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
						@click="onCancel"
					>
						{{ cancelText ?? 'Cancel' }}
					</button>
					<button
						class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
						@click="onConfirm"
					>
						{{ confirmText ?? 'Delete' }}
					</button>
				</div>
			</div>
		</div>
	</teleport>
</template>
