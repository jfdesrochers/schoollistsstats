const m = require('mithril')
const Chart = require('chart.js')
const firebase = require('firebase')

const fbConfig = {
    apiKey: "AIzaSyCLfRorZqnXbKW-GOYh7zjPdWGza8ooCpU",
    authDomain: "schoollistman.firebaseapp.com",
    databaseURL: "https://schoollistman.firebaseio.com",
    projectId: "schoollistman",
    storageBucket: "schoollistman.appspot.com",
    messagingSenderId: "956448932336"
}
firebase.initializeApp(fbConfig)

const palette = ["#e39c37", "#d92120", "#4d95be", "#e6662d", "#549fb4", "#a5be54", "#5ca8a4", "#e34f29", "#97bd5d", "#b3bd4d", "#3f54a5", "#8abb67", "#7db874", "#781c81", "#66af93", "#404197", "#d5b13e", "#df3724", "#4787c2", "#e68d34", "#4378be", "#cbb742", "#442e8b", "#dda83a", "#e77b30", "#4c2082", "#5b187e", "#71b483", "#bfbb47", "#4067b3"]

const displabel = ['Districts', 'Stores', 'Schools', 'Classes']

const StatsApp = {}

StatsApp.oninit = function () {
    let self = this

    self.dispLevel = 0 // 0 = district, 1 = store, 2 = school, 3 = class
    self.dispFocus = {
        district: '',
        store: '',
        school: ''
    }
    self.setDispFocus = function (district, store, school) {
        return (e) => {
            e.preventDefault()
            self.dispLevel = 0 + (district ? 1 : 0) + (store ? 1 : 0) + (school ? 1 : 0)
            self.dispFocus = {'district': district || '', 'store': store || '', 'school': school || ''}
            self.updateChart()
        }
    }

    self.db = firebase.database()
    self.data = []
    self.dataTotal = 0
    self.dataRef = self.db.ref('stores')
    self.dataRef.on('value', (snap) => {
        self.data = []
        self.dataTotal = 0
        let data = snap.val()
        for (let distno in data) {
            let curDist = {no: distno, total: 0, stores: []}
            for (let storeno in data[distno]) {
                let curStore = {no: storeno, total: 0, schools: []}
                if ('schools' in data[distno][storeno]) {
                    data[distno][storeno].schools.forEach((sdata) => {
                        let curSchool = {name: sdata.name, total: 0, classes: []}
                        sdata.classes.forEach((cdata) => {
                            let curClass = {name: cdata.name, total: 0}
                            if ('stats' in data[distno][storeno]) {
                                curClass.total = data[distno][storeno]['stats'][cdata.id] || 0
                            }
                            curSchool.total = curSchool.total + curClass.total
                            curStore.total = curStore.total + curClass.total
                            curDist.total = curDist.total + curClass.total
                            self.dataTotal = self.dataTotal + curClass.total
                            curSchool.classes.push(curClass)
                        })
                        curSchool.classes.sort((a,b) => {return b.total - a.total})
                        curStore.schools.push(curSchool)
                    })
                }
                curStore.schools.sort((a,b) => {return b.total - a.total})
                curDist.stores.push(curStore)
            }
            curDist.stores.sort((a,b) => {return b.total - a.total})
            self.data.push(curDist)
        }
        self.data.sort((a,b) => {return b.total - a.total})
        self.updateChart()
        m.redraw()
    })

    self.chart = null
    self.generateChartData = function () {
        let data = []
        let labels = []
        switch (self.dispLevel) {
            case 0: {
                self.data.forEach((d) => {
                    data.push(d.total)
                    labels.push(d.no)
                })
                break
            }
            case 1: {
                self.data.find((d) => d.no == self.dispFocus.district).stores.forEach((s) => {
                    data.push(s.total)
                    labels.push(s.no)
                })
                break
            }
            case 2: {
                self.data.find((d) => d.no == self.dispFocus.district).stores.find((s) => s.no == self.dispFocus.store).schools.forEach((sc) => {
                    data.push(sc.total)
                    labels.push(sc.name)
                })
                break
            }
            case 3: {
                self.data.find((d) => d.no == self.dispFocus.district).stores.find((s) => s.no == self.dispFocus.store).schools.find((sc) => sc.name == self.dispFocus.school).classes.forEach((c) => {
                    data.push(c.total)
                    labels.push(c.name)
                })
                break
            }
        }
        return {data: data, labels: labels}
    }
    self.createChart = function (vdom) {
        let ctx = vdom.dom.getContext('2d')
        let chartData = self.generateChartData()
        self.chart = new Chart(ctx, {
            type: 'pie',
            data: {
                datasets: [{
                    data: chartData.data,
                    backgroundColor: palette
                }],
                labels: chartData.labels
            },
            options: {
                onClick: function (e, a) {
                    let clickedElem = a[0]._view.label
                    if (clickedElem && self.dispLevel < 3) {
                        if (self.dispLevel == 0) {
                            self.dispFocus.district = clickedElem
                        } else if (self.dispLevel == 1) {
                            self.dispFocus.store = clickedElem
                        } else if (self.dispLevel == 2) {
                            self.dispFocus.school = clickedElem
                        }
                        self.dispLevel = self.dispLevel + 1
                        self.updateChart()
                        m.redraw()
                    }
                }
            }
        })
    }
    self.removeChart = function () {
        self.chart = null
    }
    self.updateChart = function () {
        if (self.chart) {
            let chartData = self.generateChartData()
            self.chart.data.labels = chartData.labels
            self.chart.data.datasets[0].data = chartData.data
            self.chart.update()
        }
    }
}

StatsApp.onremove = function () {
    let self = this
    self.dataRef.off('value')
}

StatsApp.view = function () {
    let self = this
    return m('div.container', [
        self.data.length > 0 ? [
            m('h1.text-center', 'School List Manager Data'),
            m('div.lead.text-center', displabel[self.dispLevel]),
            m('div.row', m('div.col-sm-6.col-sm-offset-3', m('canvas#statChart', {oncreate: self.createChart, onremove: self.removeChart}))),
            m('a[href="#"]', {onclick: self.setDispFocus()}, 'Reset'),
            m('table.table.table-striped.table-responsive', [
                m('thead', m('tr', [
                    m('th', 'District'),
                    self.dispLevel >= 1 ? m('th', 'Store') : '',
                    self.dispLevel >= 2 ? m('th', 'School') : '',
                    self.dispLevel == 3 ? m('th', 'Class') : '',
                    m('th', 'Total')
                ])),
                m('tbody', [
                    self.data.map((dst) => {
                        return [
                            m('tr', [
                                m('td', m('a[href="#"]', {onclick: self.setDispFocus(dst.no)}, dst.no)),
                                self.dispLevel >= 1 ? m('td') : '',
                                self.dispLevel >= 2 ? m('td') : '',
                                self.dispLevel == 3 ? m('td') : '',
                                m('td', dst.total)
                            ]),
                            (self.dispLevel >= 1 && self.dispFocus.district == dst.no) ? dst.stores.map((st) => {
                                return [
                                    m('tr', [
                                        m('td'),
                                        m('td', m('a[href="#"]', {onclick: self.setDispFocus(dst.no, st.no)}, st.no)),
                                        self.dispLevel >= 2 ? m('td') : '',
                                        self.dispLevel == 3 ? m('td') : '',
                                        m('td', st.total)
                                    ]),
                                    (self.dispLevel >= 2 && self.dispFocus.store == st.no) ? st.schools.map((sch) => {
                                        return [
                                            m('tr', [
                                                m('td'),
                                                m('td'),
                                                m('td', m('a[href="#"]', {onclick: self.setDispFocus(dst.no, st.no, sch.name)}, sch.name)),
                                                self.dispLevel == 3 ? m('td') : '',
                                                m('td', sch.total)
                                            ]),
                                            (self.dispLevel == 3 && self.dispFocus.school == sch.name) ? sch.classes.map((cls) => {
                                                return m('tr', [
                                                    m('td'),
                                                    m('td'),
                                                    m('td'),
                                                    m('td', cls.name),
                                                    m('td', cls.total)
                                                ])
                                            }) : ''
                                        ]
                                    }) : ''
                                ]
                            }) : ''
                        ]
                    })
                ])
            ]),
            m('div.lead.text-center', 'Grand total: ' + self.dataTotal)
        ] : m('div.lead.text-center.mt50', 'Loading, please wait...')
    ])
}

m.mount(document.getElementById('stcontents'), StatsApp)