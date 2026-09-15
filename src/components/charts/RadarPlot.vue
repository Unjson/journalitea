<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { aromaFieldLabels } from '../../models/enums';

type AromaKey = typeof aromaFieldLabels[number]['key'];

export interface DataPoint {
  key: AromaKey;
  value: number;
}

interface Props {
  dataPoints?: DataPoint[];
  maxValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  dataPoints: () => [],
  maxValue: 5,
});

const { t } = useI18n();

const size = 300;
const center = size / 2;
const maxRadius = (size / 2) - 40;
const minRadius = maxRadius * 0.15; // Minimum distance from center for value 0

const sanitizeValue = (value: number): number => {
  if (value == null || isNaN(value)) {
    return 0;
  }
  return value;
};

const dataPointMap = computed(() => {
  const map = new Map<AromaKey, number>();
  for (const point of props.dataPoints) {
    map.set(point.key, sanitizeValue(point.value));
  }
  return map;
});

const dataPoints = computed(() =>
  aromaFieldLabels.map((field) => ({
    key: field.key,
    label: t(field.label),
    value: dataPointMap.value.get(field.key) ?? 0,
  }))
);

const angleStep = (2 * Math.PI) / dataPoints.value.length;

const getPoint = (index: number, value: number) => {
  const angle = angleStep * index - Math.PI / 2; // Start from top
  
  // Special case: -1 means center point
  if (value === -1) {
    return {
      x: center,
      y: center,
    };
  }
  
  // Calculate radius with minimum offset for 0 values
  const normalizedValue = value / props.maxValue;
  const radius = minRadius + (normalizedValue * (maxRadius - minRadius));
  
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
};

const getLabelPoint = (index: number) => {
  const angle = angleStep * index - Math.PI / 2;
  const radius = maxRadius + 25;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
};

const dataPath = computed(() => {
  const points = dataPoints.value.map((point, i) => {
    const { x, y } = getPoint(i, point.value);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  return points.join(' ') + ' Z';
});

const gridLevels = computed(() => {
  const levels = [];
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const normalizedStep = i / steps;
    const radius = minRadius + (normalizedStep * (maxRadius - minRadius));
    const points = [];
    for (let j = 0; j < dataPoints.value.length; j++) {
      const angle = angleStep * j - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      points.push(`${j === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    levels.push(points.join(' ') + ' Z');
  }
  return levels;
});

const axisLines = computed(() => {
  return dataPoints.value.map((_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    return {
      x1: center,
      y1: center,
      x2: center + maxRadius * Math.cos(angle),
      y2: center + maxRadius * Math.sin(angle),
    };
  });
});

const zeroLine = computed(() => {
  const points = [];
  for (let j = 0; j < dataPoints.value.length; j++) {
    const angle = angleStep * j - Math.PI / 2;
    const x = center + minRadius * Math.cos(angle);
    const y = center + minRadius * Math.sin(angle);
    points.push(`${j === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return points.join(' ') + ' Z';
});
</script>

<template>
  <div class="radar-plot">
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="radar-svg mx-auto"
      role="img"
    >
      <!-- Grid levels -->
      <path
        v-for="(level, i) in gridLevels"
        :key="`grid-${i}`"
        :d="level"
        fill="none"
        stroke="var(--color-chart-grid)"
        stroke-width="1"
      />
      
      <!-- Zero line -->
      <path
        :d="zeroLine"
        fill="none"
        stroke="var(--color-chart-axis)"
        stroke-width="1"
        stroke-dasharray="3,3"
      />
      
      <!-- Axis lines -->
      <line
        v-for="(line, i) in axisLines"
        :key="`axis-${i}`"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        stroke="var(--color-chart-axis)"
        stroke-width="1"
      />
      
      <!-- Data polygon -->
      <path
        :d="dataPath"
        fill="color-mix(in srgb, var(--color-chart-primary) 28%, transparent)"
        stroke="var(--color-chart-primary)"
        stroke-width="2"
        class="data-polygon"
      />
      
      <!-- Data points -->
      <circle
        v-for="(point, i) in dataPoints"
        :key="`point-${i}`"
        :cx="getPoint(i, point.value).x"
        :cy="getPoint(i, point.value).y"
        r="4"
        fill="var(--color-chart-primary)"
        class="data-point"
        :style="{
          '--start-x': `${center}px`,
          '--start-y': `${center}px`,
          '--end-x': `${getPoint(i, point.value).x}px`,
          '--end-y': `${getPoint(i, point.value).y}px`,
        }"
      />
      
      <!-- Labels -->
      <text
        v-for="(point, i) in dataPoints"
        :key="`label-${i}`"
        :x="getLabelPoint(i).x"
        :y="getLabelPoint(i).y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="text-xs font-medium fill-gray-700"
      >
        {{ point.label }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.radar-plot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.radar-svg {
  width: 100%;
  height: auto;
  max-width: 320px;
}

.data-polygon {
  animation: radarGrow .6s ease-out;
  transform-origin: center;
  transform-box: fill-box;
}

.data-point {
  animation: pointSlide .6s ease-out;
}

@keyframes radarGrow {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pointSlide {
  from {
    cx: var(--start-x);
    cy: var(--start-y);
    opacity: 0;
  }
  to {
    cx: var(--end-x);
    cy: var(--end-y);
    opacity: 1;
  }
}
</style>
