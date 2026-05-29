<script lang="ts" setup>
const props = withDefaults(
	defineProps<{
		modelValue: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		secondaryText?: string;
		closeOnBackdrop?: boolean;
		showCancel?: boolean;
		showConfirm?: boolean;
	}>(),
	{
		closeOnBackdrop: true,
		showCancel: true,
		showConfirm: true,
	},
);

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'confirm'): void;
	(e: 'cancel'): void;
	(e: 'secondary'): void;
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

const onSecondary = () => {
	emit('secondary');
	close();
};

const onBackdropClick = () => {
	if (props.closeOnBackdrop === false) return;
	onCancel();
};

const isSingleAction = () =>
	props.showConfirm && !props.showCancel && !props.secondaryText;
</script>

<template>
	<teleport to="body">
		<div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
			<div class="absolute inset-0 bg-black/50" @click="onBackdropClick"></div>
			<div class="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-lg p-6">
				<h3 class="text-lg font-semibold mb-2">
					{{ title ?? 'Confirm' }}
				</h3>
				<p class="mb-6 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
					{{ message ?? 'Are you sure?' }}
				</p>
				<div class="flex justify-end gap-3">
					<button
						v-if="showCancel"
						class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
						@click="onCancel"
					>
						{{ cancelText ?? 'Cancel' }}
					</button>
					<button
						v-if="secondaryText"
						class="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
						@click="onSecondary"
					>
						{{ secondaryText }}
					</button>
					<button
						v-if="showConfirm"
						:class="[
							'px-4 py-2 rounded-lg text-white',
							isSingleAction()
								? 'dialog-button-neutral'
								: 'dialog-button-danger',
						]"
						@click="onConfirm"
					>
						{{ confirmText ?? 'Delete' }}
					</button>
				</div>
			</div>
		</div>
	</teleport>
</template>

<style scoped>
.dialog-button-danger {
	background-color: #dc2626;
}

.dialog-button-danger:hover {
	background-color: #b91c1c;
}

.dialog-button-neutral {
	background-color: #1f2937;
}

.dialog-button-neutral:hover {
	background-color: #374151;
}
</style>
