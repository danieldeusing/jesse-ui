<template>
  <div class="grid grid-cols-1 gap-4 items-start lg:grid-cols-3 p-6">
    <!-- left column -->
    <div class="grid grid-cols-1 gap-4 lg:col-span-2 px-1">
      <section aria-labelledby="section-1-title">
        <div class="rounded-lg">
          <slot name="left" />
        </div>
      </section>
    </div>

    <!-- right column -->
    <div class="grid grid-cols-1 gap-4">
      <section aria-labelledby="section-2-title">
        <slot name="right" />
      </section>
    </div>
  </div>
</template>
