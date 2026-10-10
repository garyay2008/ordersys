<template>
  <div id="cmmodity">
    <el-row>
      <span class="search-tittle">貨品搜索：</span>
      <el-col
        :xs="8"
        :sm="6"
        :md="6"
        :lg="5"
      >
        <el-input
          placeholder="請輸入貨品名稱或編號"
          size="small"
          prefix-icon="el-icon-search"
          @input="loadData"
          v-model="search"
          clearable
        >
        </el-input>
      </el-col>

      <el-button
        type="primary"
        size="small"
        class="btn-shadow"
        @click="addCommodity()"
      >添加貨品</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table
          :data="tableData"
          size="medium"
          :max-height="tableHeight"
          style="width: 100%"
        >
          <el-table-column
            align="center"
            width="100"
            label="貨品圖片"
          >
            <template slot-scope="scope">
              <img
                :src="scope.row.img"
                width="80px"
                height="80px"
                alt=""
              >
            </template>
          </el-table-column>
          <el-table-column
            align="center"
            prop="plu"
            width="100"
            label="PLU 碼"
          >
            <template slot-scope="scope">
              <span v-if="scope.row.plu">{{ scope.row.plu }}</span>
              <span v-else class="no-station">—</span>
            </template>
          </el-table-column>
          <el-table-column
            align="center"
            prop="code"
            width="120"
            label="貨品編號"
          >
            <template slot-scope="scope">
              <span v-if="scope.row.code">{{ scope.row.code }}</span>
              <span v-else class="no-station">—</span>
            </template>
          </el-table-column>
          <el-table-column
            align="center"
            prop="name"
            width="150"
            label="貨品名稱"
          ></el-table-column>
          <el-table-column
            align="center"
            prop="describe"
            label="貨品描述"
          ></el-table-column>
          <el-table-column
            align="center"
            prop="category"
            width="120"
            label="貨品分類"
          ></el-table-column>
          <el-table-column
            align="center"
            width="190"
            label="打印機隊列"
          >
            <template slot-scope="scope">
              <template v-if="scope.row.stations && scope.row.stations.length">
                <el-tag size="mini" v-for="(s, i) in scope.row.stations" :key="i" style="margin: 1px;">{{ s }}</el-tag>
              </template>
              <el-tag size="mini" v-else-if="scope.row.station">{{ scope.row.station }}</el-tag>
              <span v-else class="no-station">未設置</span>
            </template>
          </el-table-column>
          <el-table-column
            align="center"
            prop="price"
            width="100"
            label="貨品價格"
          ></el-table-column>
          <el-table-column
            align="center"
            width="100"
            label="貨品打折"
          >
            <template slot-scope="scope">
              {{ scope.row.isDiscount?'是':'否' }}
            </template>
          </el-table-column>
          <el-table-column
            align="center"
            prop="onSale"
            width="100"
            label="折前價格"
          ></el-table-column>
          <el-table-column
            align="center"
            width="100"
            label="售罄情況"
          >
            <template slot-scope="scope">
              {{ scope.row.soldOut?'是':'否' }}
            </template>
          </el-table-column>
          <el-table-column
            fixed="right"
            align="center"
            width="120"
            label="操作"
          >
            <template slot-scope="scope">
              <el-button
                type="text"
                size="small"
                @click="editCommodity(scope.row)"
              >編輯</el-button>
              <el-button
                type="text"
                size="small"
                @click="copyCommodity(scope.row)"
              >複製</el-button>
              <el-button
                type="text"
                size="small"
                @click="delCommodity(scope.row)"
              >刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>
    <el-row>
      <el-col :span="24">
        <el-pagination
          class="pagination"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page.sync="paginations.page_index"
          :page-sizes="paginations.page_sizes"
          :page-size="paginations.page_size"
          :layout="paginations.layout"
          :total="paginations.total"
        >
        </el-pagination>
      </el-col>
    </el-row>

    <CommodityDialog
      :dialog="dialog"
      :categoryList="categoryList"
      :form="form"
      @update="loadData"
    ></CommodityDialog>
  </div>
</template>

<script>
import CommodityDialog from '@/components/admin/CommodityDialog'

function makeSpecs (existing) {
  const arr = []
  for (let i = 0; i < 10; i++) {
    const prev = (Array.isArray(existing) && existing[i]) ? existing[i] : {}
    const raw = prev.price
    arr.push({
      name: '價格' + (i + 1),
      price: (raw === '' || raw == null) ? '' : raw
    })
  }
  return arr
}

export default {
  name: 'cmmodity',
  data () {
    return {
      dialog: {
        show: false,
        title: '',
        option: 'add'
      },
      form: {
        img: '',
        name: '',
        name2: '',
        describe: '',
        category: '',
        price: 0,
        isDiscount: false,
        onSale: 0,
        soldOut: false,
        specs: makeSpecs(),
        stations: [],
        modCategories: [],
        plu: '',
        code: '',
        openPrice: false,
        mandatory: false,
        nonBusiness: false
      },
      tableData: [],
      tableHeight: window.innerHeight - 194,
      categoryList: [],
      search: '',
      suggests: [],
      paginations: {
        page_index: 1,
        total: 0,
        page_size: 5,
        page_sizes: [5, 10, 15, 20],
        layout: 'total, sizes, prev, pager, next, jumper'
      }
    }
  },
  methods: {
    handleSizeChange (val) {
      this.paginations.page_size = val
      this.loadData()
    },
    handleCurrentChange (val) {
      this.loadData()
    },
    loadData () {
      const page = {
        index: this.paginations.page_index,
        size: this.paginations.page_size,
        name: this.search
      }
      this.$axios.post('/api/commodity/get', page)
        .then(res => {
          this.tableData = res.data.result
          this.paginations.total = res.data.total
        })
        .catch(err => console.log(err))
    },
    addCommodity () {
      this.dialog = {
        show: true,
        title: '添加貨品',
        option: 'add'
      }
      this.form = {
        img: '',
        name: '',
        name2: '',
        describe: '',
        category: '',
        price: 0,
        isDiscount: false,
        onSale: 0,
        soldOut: false,
        specs: makeSpecs(),
        stations: [],
        modCategories: [],
        department: '',
        bundleGroupId: '',
        plu: '',
        code: '',
        openPrice: false,
        mandatory: false,
        nonBusiness: false
      }
    },
    editCommodity (row) {
      this.dialog = {
        show: true,
        title: '編輯貨品',
        option: 'edit'
      }
      this.form = JSON.parse(JSON.stringify(row))
      if (!this.form.code) this.form.code = ''
      if (!this.form.name2) this.form.name2 = ''
      this.form.specs = makeSpecs(row.specs)
      // 兼容舊數據：單值 station → 多隊列 stations
      if (!this.form.stations || !this.form.stations.length) {
        this.form.stations = this.form.station ? [this.form.station] : []
      }
      if (!this.form.modCategories) this.form.modCategories = []
      if (!this.form.department) this.form.department = ''
      if (this.form.bundleGroupId === undefined) this.form.bundleGroupId = ''
      if (this.form.openPrice === undefined) this.form.openPrice = false
      if (this.form.mandatory === undefined) this.form.mandatory = false
      if (this.form.nonBusiness === undefined) this.form.nonBusiness = false
    },
    copyCommodity (row) {
      const copy = JSON.parse(JSON.stringify(row))
      delete copy._id
      copy.name = row.name + '（副本）'
      // auto PLU：原 PLU 非空時自動加後綴避免重複
      if (row.plu) {
        copy.plu = row.plu + '-C'
      }
      // auto 貨品編號：原編號非空時自動加後綴避免重複
      if (row.code) {
        copy.code = row.code + '-C'
      }
      this.dialog = {
        show: true,
        title: '複製貨品',
        option: 'add'
      }
      this.form = copy
      if (!this.form.name2) this.form.name2 = ''
      this.form.specs = makeSpecs(row.specs)
      if (!this.form.stations || !this.form.stations.length) {
        this.form.stations = this.form.station ? [this.form.station] : []
      }
      if (!this.form.modCategories) this.form.modCategories = []
      if (!this.form.department) this.form.department = ''
      if (this.form.bundleGroupId === undefined) this.form.bundleGroupId = ''
      if (this.form.openPrice === undefined) this.form.openPrice = false
      if (this.form.mandatory === undefined) this.form.mandatory = false
      if (this.form.nonBusiness === undefined) this.form.nonBusiness = false
    },
    delCommodity (row) {
      this.$confirm(`確認刪除貨品 “${row.name}” 嗎？`)
        .then(_ => {
          this.$axios.post('/api/commodity/del', { _id: row._id })
            .then(result => {
              this.$message({
                type: 'success',
                message: result.data
              })
              this.loadData()
            })
            .catch(err => {
              console.log(err)
            })
        })
        .catch(_ => { })
    }
  },
  created () {
    this.loadData()
    this.$axios.get('/api/category/all')
      .then(res => {
        this.categoryList = res.data
      })
      .catch(err => console.log(err))
    window.onresize = () => {
      this.tableHeight = window.innerHeight - 194
    }
  },
  components: {
    CommodityDialog
  }
}
</script>
<style scoped>
#cmmodity {
  height: 100%;
}
.row-height {
  margin-top: 10px;
  overflow: auto;
}
.btn-shadow {
  float: right;
  top: 0;
  box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
}
.warn-shadow {
  box-shadow: 0px 0px 20px rgba(255, 255, 220, 0.3);
}
.box-card {
  box-shadow: 1px 1px 15px rgba(58, 59, 69, 0.3) !important;
  border-radius: 6px;
}
.search-tittle {
  display: inline-block;
  float: left;
  height: 32px;
  line-height: 32px;
  color: #111;
}
.pagination {
  margin-top: 10px;
  float: right;
}
.no-station{
    color: #c0c4cc;
    font-size: 12px;
}
</style>
