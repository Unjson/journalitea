<script lang="ts" setup>
const props = withDefaults(
	defineProps<{
		modelValue: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		secondaryText?: string;
		progress?: number;
		confirmNeutral?: boolean;
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
		<div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div class="absolute inset-0 bg-black/50" @click="onBackdropClick"></div>
			<div class="ui-surface relative w-full max-w-md p-6">
				<h3 class="text-lg font-semibold mb-2">
					{{ title ?? 'Confirm' }}
				</h3>
				<p class="ui-muted mb-6 whitespace-pre-line text-sm">
					{{ message ?? 'Are you sure?' }}
				</p>
				<div
					v-if="progress !== undefined"
					class="mb-6"
					role="progressbar"
					aria-valuemin="0"
					aria-valuemax="100"
					:aria-valuenow="progress"
				>
					<div class="ui-progress-track h-2 overflow-hidden rounded-full">
						<div
							class="ui-progress-value h-full rounded-full transition-[width] duration-300"
							:style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
						></div>
					</div>
					<div class="ui-muted mt-2 text-right text-xs font-semibold">
						{{ Math.round(progress) }}%
					</div>
				</div>
				<div class="flex justify-end gap-3">
					<button
						v-if="showCancel"
						class="ui-button px-4 py-2"
						@click="onCancel"
					>
						{{ cancelText ?? 'Cancel' }}
					</button>
					<button
						v-if="secondaryText"
						class="ui-button ui-button--primary px-4 py-2"
						@click="onSecondary"
					>
						{{ secondaryText }}
					</button>
					<button
						v-if="showConfirm"
						:class="[
							'ui-button px-4 py-2',
							confirmNeutral || isSingleAction()
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
	background-color: var(--color-danger);
	border-color: var(--color-danger);
	color: #ffffff;
}

.dialog-button-danger:hover {
	background-color: var(--color-danger-hover);
	border-color: var(--color-danger-hover);
}

.dialog-button-neutral {
	background-color: var(--color-primary);
	border-color: var(--color-primary);
	color: #ffffff;
}

.dialog-button-neutral:hover {
	background-color: var(--color-primary-hover);
	border-color: var(--color-primary-hover);
}
</style>
