import { defineStore } from 'pinia'
import _ from 'lodash'
import helpers from '@/utils/helpers'
import { useRouter } from 'vue-router'

let idCounter = 0
const router = useRouter()

function newTab() {
    return _.cloneDeep({
        id: ++idCounter,
        name: 'Tab 0',
        form: {
            start_date: '2021-01-01',
            exchange: '',
            symbol: '',
        },
        results: {
            showResults: false,
            executing: false,
            progressbar: {
                current: 0,
                estimated_remaining_seconds: 0
            },
            metrics: [],
            infoLogs: '',
            exception: {
                error: '',
                traceback: ''
            },
            alert: {
                message: '',
                type: ''
            }
        }
    })
}

export const useCandlesStore = defineStore('candles', {
    state: () => ({
        tabs: {
            1: newTab() as Tab
        } as Tabs,
        candlesForm: {} as TabCandles
    }),
    actions: {
        addTab() {
            const tab = newTab()
            this.tabs[tab.id] = tab
            return router.push(`/candles/${tab.id}`)
        },
        startInNewTab(id: number) {
            const tab = newTab()
            tab.form = _.cloneDeep(this.tabs[id].form)
            this.tabs[tab.id] = tab
            this.start(tab.id)
        },
        async start(id: number) {
            console.log(id)
            this.tabs[id].results.progressbar.current = 0
            this.tabs[id].results.executing = true
            this.tabs[id].results.infoLogs = ''
            this.tabs[id].results.exception.traceback = ''
            this.tabs[id].results.exception.error = ''
            this.tabs[id].results.alert.message = ''

            const { data, error } = await usePostApi('/import-candles', { id, exchange: this.tabs[id].form.exchange, symbol: this.tabs[id].form.symbol, start_date: this.tabs[id].form.start_date }, true)

            if (error.value && error.value.statusCode !== 200) {
                showNotification('error', error.value.data.message)
                return
            }
        },
        async cancel(id: number) {
            if (this.tabs[id].results.exception.error) {
                this.tabs[id].results.executing = false
                return
            }

            const { data, error } = await usePostApi('/import-candles', { id }, true)

            if (error.value && error.value.statusCode !== 200) {
                showNotification('error', error.value.data.message)
                return
            }
        },

        progressbarEvent(id: number, data: any) {
            this.tabs[id].results.progressbar = data

            if (this.tabs[id].results.progressbar.current < 100 && this.tabs[id].results.executing === false) {
                this.tabs[id].results.executing = true
            }
        },
        alertEvent(id: number, data: any) {
            this.tabs[id].results.alert = data

            // session is finished:
            this.tabs[id].results.progressbar.current = 100
            this.tabs[id].results.executing = false
            this.tabs[id].results.exception.traceback = ''
            this.tabs[id].results.exception.error = ''
        },
        infoLogEvent(id: number, data: any) {
            this.tabs[id].results.infoLogs += `[${helpers.timestampToTime(
                data.timestamp
            )}] ${data.message}\n`
        },
        exceptionEvent(id: number, data: any) {
            this.tabs[id].results.exception.error = data.error
            this.tabs[id].results.exception.traceback = data.traceback
        },
        terminationEvent(id: number) {
            if (this.tabs[id].results.executing) {
                this.tabs[id].results.executing = false
                showNotification('success', 'Session terminated successfully')
            }
        },
        updateCandlesForm(form: TabCandles) {
            this.candlesForm = form
        }
    }
})
