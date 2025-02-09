import { defineStore } from 'pinia'
import _ from 'lodash'
import helpers from '@/utils/helpers'
import { useMainStore } from '~/stores/mainStore'

function newTab(): BacktestTab {
  return _.cloneDeep({
    id: helpers.uuid(),
    form: {
      start_date: '2024-01-01',
      finish_date: '2024-03-01',
      debug_mode: false,
      export_chart: false,
      export_tradingview: false,
      export_full_reports: false,
      export_csv: false,
      export_json: false,
      fast_mode: false,
      benchmark: true,
      exchange: '',
      routes: [] as Route[],
      data_routes: [] as DataRoute[]
    },
    results: {
      showResults: false,
      executing: false,
      logsModal: false,
      progressbar: {
        current: 0,
        estimated_remaining_seconds: 0
      },
      routes_info: [],
      metrics: [],
      hyperparameters: [],
      generalInfo: {},
      infoLogs: '',
      exception: {
        error: '',
        traceback: ''
      },
      charts: {
        equity_curve: []
      },
      alert: {
        message: '',
        type: ''
      },
      info: []
    }
  })
}

export const useBacktestStore = defineStore('backtest', {
  state: () => ({
    tabs: {} as BacktestTabs,
  }),
  persist: {
    storage: persistedState.localStorage,
  },
  actions: {
    async init(activeWorkers: Set<string>) {
      for (const key in this.tabs) {
        const tab = this.tabs[key]
        if (tab.results.executing && !tab.results.exception.error) {
          // if the tab is executing, we need to sync the tab with the server
          if (!activeWorkers.has(tab.id)) {
            // if the tab is not in the active workers list, we need to cancel it
            await this.cancel(tab.id)
          }
        }
      }
    },
    async addTab(id?: string | null) {
      const tab = newTab()
      this.tabs[tab.id] = tab
      if (id) {
        const oldTab = this.tabs[id]
        tab.form = JSON.parse(JSON.stringify(oldTab.form))
      }
      await navigateTo(`/backtest/${tab.id}`)
    },
    closeTab(id: string) {
      delete this.tabs[id]
      navigateTo('/backtest')
    },
    async startInNewTab(id: string) {
      const tab = newTab()
      tab.form = _.cloneDeep(this.tabs[id].form)
      this.tabs[tab.id] = tab
      this.start(tab.id)
      await navigateTo(`/backtest/${tab.id}`)
    },
    async start(id: string) {
      this.tabs[id].results.progressbar.current = 0
      this.tabs[id].results.executing = true
      this.tabs[id].results.infoLogs = ''
      this.tabs[id].results.exception.traceback = ''
      this.tabs[id].results.exception.error = ''
      if (!this.tabs[id].results.alert) {
        this.tabs[id].results.alert = {
          message: '',
          type: ''
        }
      }
      this.tabs[id].results.alert.message = ''

      // validate that in case the fast mode is enabled the number of trading routes is not more than one
      if (this.tabs[id].form.fast_mode && this.tabs[id].form.routes.length > 1) {
        showNotification('error', 'For the moment, the fast mode can only be used with one trading route')
        this.tabs[id].results.executing = false
        return
      }

      const { data, error } = await usePostApi('/backtest', {
        id,
        exchange: this.tabs[id].form.exchange,
        routes: this.tabs[id].form.routes,
        data_routes: this.tabs[id].form.data_routes,
        config: useMainStore().settings.backtest,
        start_date: this.tabs[id].form.start_date,
        finish_date: this.tabs[id].form.finish_date,
        debug_mode: this.tabs[id].form.debug_mode,
        export_csv: this.tabs[id].form.export_csv,
        export_chart: this.tabs[id].form.export_chart,
        export_tradingview: this.tabs[id].form.export_tradingview,
        export_full_reports: this.tabs[id].form.export_full_reports,
        export_json: this.tabs[id].form.export_json,
        fast_mode: this.tabs[id].form.fast_mode,
        benchmark: this.tabs[id].form.benchmark
      }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
        this.tabs[id].results.executing = false
        return
      }
    },
    async cancel(id: string) {
      if (this.tabs[id].results.exception.error) {
        this.tabs[id].results.executing = false
        return
      }

      const { data, error } = await usePostApi('/cancel-backtest', { id }, true)

      if (error.value && error.value.statusCode !== 200) {
        showNotification('error', error.value.data.message)
      }

      this.tabs[id].results.executing = false
    },
    rerun(id: string) {
      this.tabs[id].results.showResults = false
      this.start(id)
    },
    newBacktest(id: string) {
      this.tabs[id].results.showResults = false
    },
    candlesInfoEvent(id: string, data: BacktestInfoEvent) {
      const list = [
        ['Period', data.duration],
        ['Starting Date', helpers.timestampToDate(
          data.starting_time
        )],
        ['Ending Date', helpers.timestampToDate(data.finishing_time)],
        ['Exchange', data.exchange],
        ['Exchange Type', data.exchange_type],
      ] as [string, string | number][]
      if (data.exchange_type === 'futures') {
        list.push(['Leverage', data.leverage])
        list.push(['Leverage Mode', data.leverage_mode])
      }
      this.tabs[id].results.info = list
    },
    routesInfoEvent(id: string, data: RoutesInfoEvent[]) {
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
      this.tabs[id].results.progressbar = data
    },
    infoLogEvent(id: string, data: { timestamp: number, message: string }) {
      this.tabs[id].results.infoLogs += `[${helpers.timestampToTime(
        data.timestamp
      )}] ${data.message}\n`
    },
    exceptionEvent(id: string, data: { error: string, traceback: string }) {
      this.tabs[id].results.exception.error = data.error
      this.tabs[id].results.exception.traceback = data.traceback
    },
    generalInfoEvent(id: string, data: BacktestGeneralInfo) {
      this.tabs[id].results.generalInfo = data
    },
    hyperparametersEvent(id: string, data: ArrayItem[]) {
      this.tabs[id].results.hyperparameters = data
    },
    metricsEvent(id: string, data: MetricsEvent) {
      // no trades were executed
      if (data === null) {
        this.tabs[id].results.metrics = []
        return
      }

      this.tabs[id].results.metrics = [
        ['Total Closed Trades', data.total],
        ['Total Net Profit', `${_.round(data.net_profit, 2)} (${_.round(data.net_profit_percentage, 2)}%)`],
        ['Starting => Finishing Balance', `${_.round(data.starting_balance, 2)} => ${_.round(data.finishing_balance, 2)}`],
        ['Open Trades', data.total_open_trades],
        // ['Open Trade\' PNL', data.open_pl],
        ['Total Paid Fees', _.round(data.fee, 2)],
        ['Max Drawdown', `${_.round(data.max_drawdown, 2)}%`],
        ['Annual Return', `${_.round(data.annual_return, 2)}%`],
        ['Expectancy', `${_.round(data.expectancy, 2)} (${_.round(data.expectancy_percentage, 2)}%)`],
        ['Avg Win | Avg Loss', `${_.round(data.average_win, 2)} | ${_.round(data.average_loss, 2)}`],
        ['Ratio Avg Win / Avg Loss', _.round(data.ratio_avg_win_loss, 2)],
        ['Win-rate', `${_.round(data.win_rate * 100, 2)}%`],
        ['Longs | Shorts', `${_.round(data.longs_percentage, 2)}% | ${_.round(data.shorts_percentage, 2)}%`],
        ['Avg Holding Time', helpers.secondsToHumanReadable(data.average_holding_period)],
        ['Winning Trades Avg Holding Time', helpers.secondsToHumanReadable(data.average_winning_holding_period)],
        ['Losing Trades Avg Holding Time', helpers.secondsToHumanReadable(data.average_losing_holding_period)],
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

      // backtest is finished, time to show charts:
      this.tabs[id].results.executing = false
      this.tabs[id].results.showResults = true
    },
    terminationEvent(id: string, data: any) {
      if (this.tabs[id].results.executing) {
        this.tabs[id].results.executing = false
        showNotification('success', 'Session terminated successfully')
      }
    },
    alertEvent(id: string, data: Alert) {
      this.tabs[id].results.alert = data
    },
    notificationEvent(id: string, data: DashboardNotification) {
      showNotification(data.type, data.message)
    }
  }
})
