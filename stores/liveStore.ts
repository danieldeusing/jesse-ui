import { defineStore } from 'pinia'
import _ from 'lodash'
import helpers from '@/utils/helpers'
import { useMainStore } from '~/stores/mainStore'

function newTab(id = '') {
  return _.cloneDeep({
    id: id || helpers.uuid(),
    form: {
      debug_mode: true,
      paper_mode: true,
      exchange_api_key_id: '',
      notification_api_key_id: '',
      exchange: '',
      routes: [] as Route[],
      data_routes: [] as DataRoute[]
    },
    results: {
      showResults: false,
      booting: false,
      monitoring: false,
      finished: false,
      terminating: false,
      progressbar: {
        current: 0,
        estimated_remaining_seconds: 0
      },
      routes_info: [],
      routes: [],
      metrics: [],
      generalInfo: {} as LiveGeneralInfoEvent,
      positions: [],
      orders: [],
      watchlist: [],
      candles: [],
      currentCandles: {} as CurrentCandlesObject,
      infoLogs: '',
      errorLogs: '',
      exception: {
        error: '',
        traceback: ''
      },
      charts: {
        equity_curve: []
      },
      selectedRoute: {} as Route,
      info: []
    }
  })
}

export const useLiveStore = defineStore('Live', {
  state: () => ({
    tabs: {} as LiveTabs
  }),
  persist: {
    storage: persistedState.localStorage
  },
  actions: {
    async init(activeWorkers: Set<string>) {
      // go through all the tabs and check if the current tab is open in another tab
      for (const key in this.tabs) {
        const tab = this.tabs[key]
        // if the tab is executing, we need to sync the tab with the server
        if (tab.results.monitoring && !tab.results.exception.error) {
          // if the tab is not in the active workers list, we need to cancel it
          if (!activeWorkers.has(tab.id)) {
            this.forceClose(tab.id)
          }
          else {
            // Fetch new data for candles and logs just in case the old ones are not valid anymore
            // Because the user has opened the dashboard after a while of the live sessions running.
            this.fetchLogs(tab.id)
          }
        }
      }
    },
    async addTab() {
      const tab = newTab()
      this.tabs[tab.id] = tab
      await navigateTo(`/live/${tab.id}`)
    },
    closeTab(id: string) {
      const tab = this.tabs[id]
      if (tab.results.monitoring && !tab.results.exception.error && !tab.results.finished) {
        showNotification('error', 'Cannot close a live session tab that is currently running')
        return
      }
      delete this.tabs[id]
      navigateTo('/live')
    },
    reset(id: string) {
      this.tabs[id].results.progressbar.current = 0
      this.tabs[id].results.booting = true
      this.tabs[id].results.finished = false
      this.tabs[id].results.infoLogs = ''
      this.tabs[id].results.errorLogs = ''
      this.tabs[id].results.exception.traceback = ''
      this.tabs[id].results.exception.error = ''
      this.tabs[id].results.routes_info = []
      this.tabs[id].results.metrics = []
      this.tabs[id].results.generalInfo = {} as LiveGeneralInfoEvent
      this.tabs[id].results.positions = []
      this.tabs[id].results.orders = []
      this.tabs[id].results.candles = []
      this.tabs[id].results.currentCandles = {}
      this.tabs[id].results.watchlist = []
    },
    async start(id: string) {
      this.reset(id)

      const mainStore = useMainStore()

      const exchange_api_key_id = this.tabs[id].form.paper_mode ? '' : this.tabs[id].form.exchange_api_key_id
      const exchange = this.tabs[id].form.exchange
      const notification_api_key_id = this.tabs[id].form.notification_api_key_id ? this.tabs[id].form.notification_api_key_id : ''

      this.tabs[id].results.selectedRoute = this.tabs[id].form.routes[0]

      const { data, error } = await usePostApi('/live', {
        id,
        exchange: exchange,
        exchange_api_key_id: exchange_api_key_id,
        notification_api_key_id: notification_api_key_id,
        routes: this.tabs[id].form.routes,
        data_routes: this.tabs[id].form.data_routes,
        config: mainStore.settings.live,
        debug_mode: this.tabs[id].form.debug_mode,
        paper_mode: this.tabs[id].form.paper_mode
      }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        return
      }
    },
    async cancel(id: string) {
      const { data, error } = await usePostApi('/cancel-live', { id, paper_mode: this.tabs[id].form.paper_mode }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        return
      }

      this.tabs[id].results.booting = false
    },
    async stop(id: string) {
      const { data, error } = await usePostApi('/cancel-live', { id, paper_mode: this.tabs[id].form.paper_mode }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        return
      }
      this.tabs[id].results.terminating = true
    },
    newLive(id: string) {
      this.tabs[id].results.monitoring = false
      this.tabs[id].results.finished = false
    },
    candlesInfoEvent(id: string, data: BacktestInfoEvent) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.info = [
        ['Period', data.duration],
        ['Starting-Ending Date', `${helpers.timestampToDate(data.starting_time)} => ${helpers.timestampToDate(data.finishing_time)}`]
      ]
    },
    routesInfoEvent(id: string, data: RoutesInfoEvent[]) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      const arr: RouteInfo[][] = []
      data.forEach((item) => {
        arr.push([
          { value: item.symbol, style: '' },
          { value: item.timeframe, style: '' },
          { value: item.strategy_name, style: '' },
        ])
      })
      this.tabs[id].results.routes_info = arr
    },
    progressbarEvent(id: string, data: ProgressBar) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.progressbar = data
    },
    infoLogEvent(id: string, data: { timestamp: number, message: string }) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.infoLogs += `[${helpers.timestampToTime(
        data.timestamp
      )}] ${data.message}\n`
    },
    errorLogEvent(id: string, data: { id: string, timestamp: number, message: string }) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      showNotification('error', data.message)

      this.tabs[id].results.errorLogs += `[${helpers.timestampToTime(
        data.timestamp
      )}] ${data.message}\n`
    },
    exceptionEvent(id: string, data: Exception) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.exception.error = data.error
      this.tabs[id].results.exception.traceback = data.traceback
    },
    generalInfoEvent(id: string, data: LiveGeneralInfoEvent) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.generalInfo = data

      // set routes in both form.routes (maybe page was refreshed)
      this.tabs[id].form.routes = this.tabs[id].results.generalInfo.routes
      // and results.routes which is where the table is read from
      this.tabs[id].results.routes = []
      for (const item of this.tabs[id].form.routes) {
        this.tabs[id].results.routes.push([
          { value: item.symbol, style: '' },
          { value: item.timeframe, style: '' },
          { value: item.strategy, style: '' },
        ])
      }

      // turn on monitoring dashboard if haven't yet
      if (!this.tabs[id].results.monitoring) {
        this.tabs[id].results.booting = false
        this.tabs[id].results.monitoring = true
        this.fetchLogs(id)
      }
    },
    async fetchCandles(id: string) {
      const { data, error } = await usePostApi('/get-candles',
        {
          id,
          exchange: this.tabs[id].form.exchange,
          symbol: this.tabs[id].results.selectedRoute.symbol,
          timeframe: this.tabs[id].results.selectedRoute.timeframe
        }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        return
      }

      const res = data.value as GetCandlesResponse
      this.tabs[id].results.candles = res.data
    },
    async fetchLogs(id: string) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.infoLogs = ''
      this.tabs[id].results.errorLogs = ''

      // info logs
      const { data, error } = await usePostApi('/get-logs', {
        id,
        type: 'info',
        start_time: this.tabs[id].results.generalInfo.started_at
      }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        return
      }

      const res = data.value as GetLogsEvent
      const arr = res.data

      this.tabs[id].results.infoLogs = ''

      arr.forEach((data: LogsData) => {
        this.tabs[id].results.infoLogs += `[${helpers.timestampToTime(
          data.timestamp
        )}] ${data.message}\n`
      })

      // error logs
      const { data: dataLog, error: errorLog } = await usePostApi('/get-logs', {
        id,
        type: 'error',
        start_time: this.tabs[id].results.generalInfo.started_at
      }, true)

      if (errorLog.value && errorLog.value.statusCode !== 200) {
        showNotification('error', errorLog.value.data.message)
        return
      }

      const resLog = dataLog.value as GetLogsEvent
      const arrLog = resLog.data
      this.tabs[id].results.errorLogs = ''

      arrLog.forEach((data: LogsData) => {
        this.tabs[id].results.errorLogs += `[${helpers.timestampToTime(
          data.timestamp
        )}] ${data.message}\n`
      })
    },
    currentCandlesEvent(id: string, data: CurrentCandlesObject) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.currentCandles = data
    },
    watchlistEvent(id: string, data: [string, string][]) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.watchlist = data
    },
    positionsEvent(id: string, data: positionsEvent[]) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.positions = []

      for (const item of data) {
        const qty = item.type === 'close' ? '' : item.qty
        this.tabs[id].results.positions.push([
          { value: item.symbol, style: '' },
          { value: qty, style: helpers.colorBasedOnType(item.type), tooltip: `${item.value} ${item.currency}` },
          { value: helpers.roundPrice(item.entry), style: '' },
          { value: helpers.roundPrice(item.current_price), style: '' },
          { value: item.liquidation_price ? helpers.roundPrice(item.liquidation_price) : '', style: '' },
          { value: `${_.round(item.pnl, 2)} (${_.round(item.pnl_perc, 2)}%)`, style: helpers.colorBasedOnNumber(item.pnl) },
        ])
      }
    },
    ordersEvent(id: string, data: ordersEvent[]) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.orders = data
    },
    metricsEvent(id: string, data: MetricsEvent) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.metrics = [
        ['Total Closed Trades', data.total],
        ['Total Net Profit', `${_.round(data.net_profit, 2)} (${_.round(data.net_profit_percentage, 2)}%)`],
        ['Starting => Finishing Balance', `${_.round(data.starting_balance, 2)} => ${_.round(data.finishing_balance, 2)}`],
        ['Open Trades', data.total_open_trades],
        ['Total Paid Fees', _.round(data.fee, 2)],
        ['Max Drawdown', _.round(data.max_drawdown, 2)],
        ['Annual Return', `${_.round(data.annual_return, 2)}%`],
        ['Expectancy', `${_.round(data.expectancy, 2)} (${_.round(data.expectancy_percentage, 2)}%)`],
        ['Avg Win | Avg Loss', `${_.round(data.average_win, 2)} | ${_.round(data.average_loss, 2)}`],
        ['Ratio Avg Win / Avg Loss', _.round(data.ratio_avg_win_loss, 2)],
        ['Win-rate', `${_.round(data.win_rate * 100, 2)}%`],
        ['Longs | Shorts', `${_.round(data.longs_percentage, 2)}% | ${_.round(data.shorts_percentage, 2)}%`],
        ['Avg Holding Time', data.average_holding_period],
        ['Winning Trades Avg Holding Time', data.average_winning_holding_period],
        ['Losing Trades Avg Holding Time', data.average_losing_holding_period],
        ['Sharpe Ratio', _.round(data.sharpe_ratio, 2)],
        ['Calmar Ratio', _.round(data.calmar_ratio, 2)],
        ['Sortino Ratio', _.round(data.sortino_ratio, 2)],
        ['Omega Ratio', _.round(data.omega_ratio, 2)],
        ['Winning Streak', data.winning_streak],
        ['Losing Streak', data.losing_streak],
        ['Largest Winning Trade', _.round(data.largest_winning_trade, 2)],
        ['Largest Losing Trade', _.round(data.largest_losing_trade, 2)],
        ['Total Winning Trades', data.total_winning_trades],
        ['Total Losing Trades', data.total_losing_trades]
      ]
    },
    equityCurveEvent(id: string, data: EquityCurve[]) {
      this.tabs[id].results.charts.equity_curve = data

      this.tabs[id].results.showResults = true
    },
    unexpectedTerminationEvent(id: string) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.finished = true
    },
    terminationEvent(id: string) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      if (!this.tabs[id].results.finished) {
        this.tabs[id].results.finished = true
        this.tabs[id].results.terminating = false
        showNotification('success', 'Session terminated successfully')
      }
    },
    forceClose(id: string) {
      if (this.tabs[id] === undefined) {
        this.tabs[id] = newTab(id)
      }

      this.tabs[id].results.finished = true
      this.tabs[id].results.terminating = false
    }
  }
})
