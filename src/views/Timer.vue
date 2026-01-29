<script lang="ts" setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import CircularTimer from '../components/CircularTimer.vue';
const singingBowlUrl = new URL('../sfx/singing-bowl.ogg', import.meta.url).toString();

const { t } = useI18n();

type TimerPreset = {
	id: string;
	labelKey: string;
	seconds: number;
};

const presets: TimerPreset[] = [
	{ id: 'western', labelKey: 'timer.preset_western', seconds: 3 * 60 },
	{ id: 'gongfu', labelKey: 'timer.preset_gongfu', seconds: 15 },
];

const activePresetId = ref<string>(presets[0].id);
const totalSeconds = ref<number>(presets[0].seconds);
const remainingSeconds = ref<number>(presets[0].seconds);
const isRunning = ref(false);

const completionAudio = new Audio(singingBowlUrl);

let intervalId: number | null = null;

const formattedTime = computed(() => {
	const minutes = Math.floor(remainingSeconds.value / 60);
	const seconds = remainingSeconds.value % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const setPreset = (preset: TimerPreset) => {
	activePresetId.value = preset.id;
	totalSeconds.value = preset.seconds;
	remainingSeconds.value = preset.seconds;
	stopTimer();
};

const tick = () => {
	if (remainingSeconds.value <= 0) {
		pauseTimer();
		return;
	}
	remainingSeconds.value -= 1;
	if (remainingSeconds.value <= 0) {
		completionAudio.currentTime = 0;
		void completionAudio.play().catch(() => undefined);
		pauseTimer();
	}
};

const startTimer = () => {
	if (remainingSeconds.value <= 0) {
		remainingSeconds.value = totalSeconds.value;
	}
	if (intervalId) return;
	isRunning.value = true;
	intervalId = window.setInterval(tick, 1000);
};

const pauseTimer = () => {
	if (intervalId) {
		window.clearInterval(intervalId);
		intervalId = null;
	}
	isRunning.value = false;
};

const stopTimer = () => {
	pauseTimer();
	remainingSeconds.value = totalSeconds.value;
};

const adjustTime = (deltaSeconds: number) => {
	const next = Math.max(0, totalSeconds.value + deltaSeconds);
	totalSeconds.value = next;
	remainingSeconds.value = Math.max(0, remainingSeconds.value + deltaSeconds);
};

const toggleTimer = () => {
	if (isRunning.value) {
		pauseTimer();
	} else {
		startTimer();
	}
};

onBeforeUnmount(() => {
	if (intervalId) {
		window.clearInterval(intervalId);
	}
});
</script>

<template>
	<div class="p-6">
		<h1 class="text-3xl font-bold mb-6">{{ t('timer.title') }}</h1>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
			<div>
				<h2 class="text-lg font-semibold mb-3">{{ t('timer.presets_title') }}</h2>
				<div class="flex flex-wrap justify-center md:justify-start gap-2">
					<button
						v-for="preset in presets"
						:key="preset.id"
						type="button"
						class="px-3 py-2 rounded-lg border text-sm transition-colors"
						:class="preset.id === activePresetId ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
						@click="setPreset(preset)"
					>
						{{ t(preset.labelKey) }}
					</button>
				</div>
			</div>

			<div class="flex flex-col items-center md:items-start gap-4">
				<CircularTimer
					:total-seconds="totalSeconds"
					:remaining-seconds="remainingSeconds"
					:display-text="formattedTime"
					:size="240"
					:paused="!isRunning && remainingSeconds < totalSeconds"
					@toggle="toggleTimer"
					@reset="stopTimer"
				/>
			</div>


			<div class="flex flex-wrap items-center md:items-start justify-center md:justify-start gap-2">
				<button
					type="button"
					class="px-3 py-2 rounded-lg border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					@click="adjustTime(activePresetId === 'gongfu' ? -5 : -60)"
				>
					{{ activePresetId === 'gongfu' ? '-5s' : '-1m' }}
				</button>
				<button
					type="button"
					class="px-3 py-2 rounded-lg border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					@click="adjustTime(activePresetId === 'gongfu' ? -1 : -15)"
				>
					{{ activePresetId === 'gongfu' ? '-1s' : '-15s' }}
				</button>
				<button
					type="button"
					class="px-3 py-2 rounded-lg border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					@click="adjustTime(activePresetId === 'gongfu' ? 1 : 15)"
				>
					{{ activePresetId === 'gongfu' ? '+1s' : '+15s' }}
				</button>
				<button
					type="button"
					class="px-3 py-2 rounded-lg border text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					@click="adjustTime(activePresetId === 'gongfu' ? 5 : 60)"
				>
					{{ activePresetId === 'gongfu' ? '+5s' : '+1m' }}
				</button>
			</div>

			<div class="flex flex-wrap justify-center md:justify-start items-center gap-3">
				<button
					type="button"
					class="px-4 py-2 rounded-lg border bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
					@click="toggleTimer"
				>
					{{ isRunning ? t('timer.pause_button') : t('timer.start_button') }}
				</button>
				<button
					type="button"
					class="px-4 py-2 rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					@click="stopTimer"
				>
					{{ t('timer.reset_button') }}
				</button>
			</div>

		</div>
	</div>
</template>
