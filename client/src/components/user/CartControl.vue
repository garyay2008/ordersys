<template>
    <div class="cartcontrol">
        <transition name="move">
            <div class="cart-decrease" v-show="food.count>0" @click.stop.prevent="decreaseCart">
                <span class="inner el-icon-remove-outline"></span>
            </div>
        </transition>
        <div class="cart-count" v-show="food.count>0">{{food.count}}</div>
        <div class="cart-add el-icon-circle-plus" @click.stop.prevent="addCart"></div>
    </div>
</template>
<script>
export default {
  props: {
    food: {
      type: Object
    },
    requireMods: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    addCart (event) {
      if (!event._constructed) {
        return
      }
      if (this.requireMods) {
        this.$emit('require-mods', this.food)
        return
      }
      if (!this.food.count) {
        // eslint-disable-next-line vue/no-mutating-props
        this.$set(this.food, 'count', 1)
      } else {
        // eslint-disable-next-line vue/no-mutating-props
        this.food.count++
      }
    },
    decreaseCart (event) {
      if (!event._constructed) {
        return
      }
      if (this.food.count) {
        // eslint-disable-next-line vue/no-mutating-props
        this.food.count--
      }
    }
  }
}
</script>
<style>
.cartcontrol{
    font-size: 0;
    display: flex;
    align-items: center;
    gap: 2px;
}
.cartcontrol .cart-decrease{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    transform: translate3d(0,0,0) rotate(0);
}
.cartcontrol .cart-decrease > .inner{
    display: inline-block;
    line-height: 28px;
    font-size: 26px;
    color: var(--primary);
    transition: all 0.15s ease;
}
.cartcontrol .cart-decrease:active > .inner{
    transform: scale(0.9);
}

.cartcontrol .cart-decrease.move-enter-active, .cartcontrol .cart-decrease.move-leave-active{
    transition: all .35s cubic-bezier(0.4, 0, 0.2, 1);
}
.cartcontrol .cart-decrease.move-enter, .cartcontrol .cart-decrease.move-leave-to{
    opacity: 0;
    transform: translate3d(20px,0,0) rotate(90deg);
}
.cartcontrol > .cart-count{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
}
.cartcontrol > .cart-add{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    line-height: 28px;
    font-size: 26px;
    color: var(--primary);
    transition: all 0.15s ease;
}
.cartcontrol > .cart-add:active{
    transform: scale(0.9);
}
</style>
