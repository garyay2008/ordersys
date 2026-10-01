<template>
    <div id="lost">
        <div class="not-found">
          <span class="title">Oops，您的訪問出錯了！...</span>
          <span class="link"><el-link href="javascript:window.history.go(-1)" type="primary">&gt;點擊此處，返回上一頁&lt;</el-link></span>
        </div>
    </div>
</template>

<script>
export default {
  name: 'NotFound'
}
</script>

<style scoped>
  #lost{
    width: 100%;
    height: 100%;
    color: #333;
    position: relative;
  }
  #lost>.not-found{
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);

    user-select: none;
  }
  #lost>.not-found>.title{
    font-size: 30px;
    text-shadow: rgb(152, 169, 233) 3px 5px 3px;
  }
  #lost>.not-found>.link{
    text-align: center;
    display: block;
    margin-top: 20px;
  }
</style>
