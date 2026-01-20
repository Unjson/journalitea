<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  sweet: number;
  floral: number;
  nutty: number;
  spicy: number;
  fire: number;
  fruity: number;
  plants: number;
  earthy: number;
  minerals: number;
  marine: number;
  maxValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxValue: 5,
});

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

const dataPoints = computed(() => [
  { label: 'Sweet', value: sanitizeValue(props.sweet) },
  { label: 'Fruity', value: sanitizeValue(props.fruity) },
  { label: 'Floral', value: sanitizeValue(props.floral) },
  { label: 'Plants', value: sanitizeValue(props.plants) },
  { label: 'Nutty', value: sanitizeValue(props.nutty) },
  { label: 'Spicy', value: sanitizeValue(props.spicy) },
  { label: 'Fire / Animal', value: sanitizeValue(props.fire) },
  { label: 'Marine', value: sanitizeValue(props.marine) },
  { label: 'Earthy', value: sanitizeValue(props.earthy) },
  { label: 'Minerals', value: sanitizeValue(props.minerals) },
]);

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
    <svg :width="size" :height="size" class="mx-auto">
      <!-- Grid levels -->
      <path
        v-for="(level, i) in gridLevels"
        :key="`grid-${i}`"
        :d="level"
        fill="none"
        stroke="#e5e7eb"
        stroke-width="1"
      />
      
      <!-- Zero line -->
      <path
        :d="zeroLine"
        fill="none"
        stroke="#d1d5db"
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
        stroke="#d1d5db"
        stroke-width="1"
      />
      
      <!-- Data polygon -->
      <path
        :d="dataPath"
        fill="rgba(59, 130, 246, 0.3)"
        stroke="rgb(59, 130, 246)"
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
        fill="rgb(59, 130, 246)"
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
