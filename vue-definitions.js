// custom graph component
Vue.component("graph", {
  props: [
    "data",
    "dates",
    "parsedDates",
    "day",
    "selectedData",
    "scale",
    "resize"
  ],

  template: '<div ref="graph" id="graph" style="height: 100%;"></div>',

  methods: {
    makeGraph() {
      this.autosetRange = true;
      this.updateTraces();
      this.updateLayout();

      Plotly.newPlot(
        this.$refs.graph,
        this.traces,
        this.layout,
        this.config
      ).then(e => {
        if (!this.graphMounted) {
          this.$emit("graph-mounted");
          this.graphMounted = true;
        }
      });

      this.$refs.graph
        .on("plotly_hover", this.onHoverOn)
        .on("plotly_unhover", this.onHoverOff)
        .on("plotly_relayout", this.onLayoutChange);

      this.updateAnimation();
    },

    onLayoutChange(data) {
      //console.log('layout change detected');

      if (data["xaxis.autorange"] && data["yaxis.autorange"]) {
        // by default, override plotly autorange
        data["xaxis.autorange"] = false;
        data["yaxis.autorange"] = false;
        this.autosetRange = true;
        this.updateLayout();
        this.updateAnimation();
      } else if (data["xaxis.range[0]"]) {
        // if range set manually
        this.autosetRange = false; // then use the manual range
        this.xrange = [data["xaxis.range[0]"], data["xaxis.range[1]"]].map(e =>
          parseFloat(e)
        );
        this.yrange = [data["yaxis.range[0]"], data["yaxis.range[1]"]].map(e =>
          parseFloat(e)
        );
      }
    },

    onHoverOn(data) {
      let curveNumber = data.points[0].curveNumber;
      let name = this.traces[curveNumber].name;
      this.traceIndices = this.traces
        .map((e, i) => (e.name == name ? i : -1))
        .filter(e => e >= 0);

      let update = { line: { color: "#68BBE8" } };

      for (let i of this.traceIndices) {
        Plotly.restyle(this.$refs.graph, update, [i]);
      }
    },

    onHoverOff(data) {
      const country = data.points[0].data.name;

      let update = {
        line: {
          color: country === "Argentina" ? "#68BBE8" : "rgba(0,0,0,0.15)"
        }
      };

      for (let i of this.traceIndices) {
        Plotly.restyle(this.$refs.graph, update, [i]);
      }
    },

    updateTraces() {
      let showDailyMarkers = this.data.length <= 2;

      let traces1 = this.data.map((e, i) => ({
        x: e.cases,
        y: e.slope,
        name: e.country,
        text: this.parsedDates.map(f => e.country + "<br>" + f),
        mode: showDailyMarkers ? "lines+markers" : "lines",
        type: "scatter",
        legendgroup: i,
        marker: {
          size: 4,
          color: e.country === "Argentina" ? "#68BBE8" : "rgba(0,0,0,0.15)"
        },
        line: {
          color: e.country === "Argentina" ? "#68BBE8" : "rgba(0,0,0,0.15)"
        },
        hoverinfo: "x+y+text",
        hovertemplate:
          "%{text}<br>Total " +
          this.selectedData +
          ": %{x:,}<br>" +
          this.selectedData +
          " Semanalmente: %{y:,}<extra></extra>"
      }));

      let traces2 = this.data.map((e, i) => ({
        x: [e.cases[e.cases.length - 1]],
        y: [e.slope[e.slope.length - 1]],
        text: e.country,
        name: e.country,
        mode: "markers+text",
        legendgroup: i,
        textposition: "top left",
        marker: {
          size: 6,
          color: "#68BBE8"
        },
        hovertemplate:
          "%{data.text}<br>Total " +
          this.selectedData +
          ": %{x:,}<br>" +
          this.selectedData +
          " Semanalmente: %{y:,}<extra></extra>"
      }));

      this.traces = [...traces1, ...traces2];
      this.traceCount = new Array(this.traces.length).fill(0).map((e, i) => i);

      this.filteredCases = Array.prototype
        .concat(...this.data.map(e => e.cases))
        .filter(e => !isNaN(e));
      this.filteredSlope = Array.prototype
        .concat(...this.data.map(e => e.slope))
        .filter(e => !isNaN(e));
    },

    updateLayout() {
      //console.log('layout updated');

      if (this.autosetRange) {
        this.setxrange();
        this.setyrange();
        this.autosetRange = false;
      }

      this.layout = {
        title:
          "Trayectoria del COVID-19 " +
          this.selectedData +
          " (" +
          this.parsedDates[this.day - 1] +
          ")",
        showlegend: false,
        xaxis: {
          title: "Total " + this.selectedData,
          type: this.scale == "Escala Logarítmica" ? "log" : "linear",
          range: this.xrange,
          titlefont: {
            size: 24,
            color: "#68BBE8"
          }
        },
        yaxis: {
          title: "Nuevos " + this.selectedData + " (en la Semana Pasada)",
          type: this.scale == "Escala Logarítmica" ? "log" : "linear",
          range: this.yrange,
          titlefont: {
            size: 24,
            color: "#68BBE8"
          }
        },
        hovermode: "closest",
        font: {
          family: "Gotham",
          color: "#14273c",
          size: 14
        }
      };
    },

    updateAnimation() {
      let traces1 = this.data.map(e => ({
        x: e.cases.slice(0, this.day),
        y: e.slope.slice(0, this.day)
      }));

      let traces2 = this.data.map(e => ({
        x: [e.cases[this.day - 1]],
        y: [e.slope[this.day - 1]]
      }));

      Plotly.animate(
        this.$refs.graph,
        {
          data: [...traces1, ...traces2],
          traces: this.traceCount,
          layout: this.layout
        },
        {
          transition: {
            duration: 0
          },
          frame: {
            // must be >= transition duration
            duration: 0,
            redraw: true
          }
        }
      );
    },

    setxrange() {
      let xmax = Math.max(...this.filteredCases, 50);

      if (this.scale == "Escala Logarítmica") {
        this.xrange = [1, Math.ceil(Math.log10(1.5 * xmax))];
      } else {
        this.xrange = [
          -0.49 * Math.pow(10, Math.floor(Math.log10(xmax))),
          Math.round(1.05 * xmax)
        ];
      }
    },

    setyrange() {
      let ymax = Math.max(...this.filteredSlope, 50);

      if (this.scale == "Escala Logarítmica") {
        this.yrange = [1, Math.ceil(Math.log10(1.5 * ymax))];
      } else {
        this.yrange = [
          -Math.pow(10, Math.floor(Math.log10(ymax)) - 2),
          Math.round(1.05 * ymax)
        ];
      }
    }
  },

  mounted() {
    this.makeGraph();
  },

  watch: {
    resize() {
      //console.log('resize detected');
      Plotly.Plots.resize(this.$refs.graph);
    },

    scale() {
      //console.log('scale change detected', this.scale);
      this.makeGraph();
    },

    day(newDay, oldDay) {
      //console.log('day change detected', oldDay, newDay);
      this.updateLayout();
      this.updateAnimation();
    },

    selectedData() {
      //console.log('selected data change detected');
      this.$emit("update:day", this.dates.length);
    },

    data() {
      //console.log('data change detected');
      this.makeGraph();
    }
  },

  computed: {},

  data() {
    return {
      filteredCases: [],
      filteredSlope: [],
      traces: [],
      layout: {},
      traceCount: [],
      traceIndices: [],
      xrange: [],
      yrange: [],
      autosetRange: true,
      graphMounted: false,
      config: {
        responsive: true
      }
    };
  }
});

// global data
let app = new Vue({
  el: "#root",

  mounted() {
    this.pullData(this.selectedData);
  },

  created: function() {
    window.addEventListener("keydown", e => {
      if (e.key == " " && this.dates.length > 0) {
        this.play();
      } else if ((e.key == "-" || e.key == "_") && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.max(this.day - 1, 8);
      } else if ((e.key == "+" || e.key == "=") && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.min(this.day + 1, this.dates.length);
      }
    });
  },

  watch: {
    selectedData() {
      this.pullData(this.selectedData);
    },

    graphMounted() {

      if (this.graphMounted && this.autoplay && this.minDay > 0) {
        this.day = this.minDay;
        this.play();
        this.autoplay = false;
      }
    }
  },

  methods: {
    myMax() {
      var par = [];
      for (var i = 0; i < arguments.length; i++) {
        if (!isNaN(arguments[i])) {
          par.push(arguments[i]);
        }
      }
      return Math.max.apply(Math, par);
    },

    myMin() {
      var par = [];
      for (var i = 0; i < arguments.length; i++) {
        if (!isNaN(arguments[i])) {
          par.push(arguments[i]);
        }
      }
      return Math.min.apply(Math, par);
    },

    pullData(selectedData) {
      if (selectedData == "Casos Confirmados") {
        Plotly.d3.csv(
          "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv",
          this.processData
        );
      } else if (selectedData == "Muertes Reportadas") {
        Plotly.d3.csv(
          "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv",
          this.processData
        );
      }
    },

    removeRepeats(array) {
      return [...new Set(array)];
    },

    processData(data) {
      let countriesToLeaveOut = ["Cruise Ship", "Diamond Princess"];

      let renameCountries = {
        "Korea, South": "Corea del Sur",
        Brazil: "Brasil",
        Mexico: "México",
        France: "Francia",
        Germany: "Alemania",
        Iran: "Irán",
        Italy: "Italia",
        Japan: "Japón",
        Spain: "España",
        US: "Estados Unidos",
        "United Kingdom": "Reino Unido"
      };

      let countries = data.map(e => e["Country/Region"]);
      countries = this.removeRepeats(countries);

      let dates = Object.keys(data[0]).slice(4);
      this.dates = dates;
      this.parsedDates = dates.map(date => {
        const [month, day, year] = date.split("/");
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      });

      let myData = [];
      for (let country of countries) {
        let countryData = data.filter(e => e["Country/Region"] == country);
        let arr = [];

        for (let date of dates) {
          let sum = countryData
            .map(e => parseInt(e[date]) || 0)
            .reduce((a, b) => a + b);
          arr.push(sum);
        }

        if (!countriesToLeaveOut.includes(country)) {
          let slope = arr.map((e, i, a) => e - a[i - 7]);

          if (Object.keys(renameCountries).includes(country)) {
            country = renameCountries[country];
          }

          myData.push({
            country: country,
            cases: arr.map(e => (e >= this.minCasesInCountry ? e : NaN)),
            slope: slope.map((e, i) =>
              arr[i] >= this.minCasesInCountry ? e : NaN
            )
          });
        }
      }

      this.covidData = myData.filter(
        e => this.myMax(...e.cases) >= this.minCasesInCountry
      );
      this.countries = this.covidData.map(e => e.country).sort();
    },

    play() {
      if (this.paused) {
        if (this.day == this.dates.length) {
          this.day = this.minDay;
        }

        this.paused = false;
        this.icon = "icons/pause.svg";
        this.increment();
      } else {
        this.paused = true;
        this.icon = "icons/play.svg";
      }
    },

    pause() {
      if (!this.paused) {
        this.paused = true;
        this.icon = "icons/play.svg";
      }
    },

    increment() {
      if (this.day == this.dates.length || this.minDay < 0) {
        this.day = this.dates.length;
        this.paused = true;
        this.icon = "icons/play.svg";
      } else if (this.day < this.dates.length) {
        if (!this.paused) {
          this.day++;
          setTimeout(this.increment, 200);
        }
      }
    },

    changeScale() {
      this.selectedScale = (this.selectedScale + 1) % 2;
    },

    toggleHide() {
      this.isHidden = !this.isHidden;
    }
  },

  computed: {
    filteredCovidData() {
      return this.covidData.filter(e =>
        this.selectedCountries.includes(e.country)
      );
    },

    minDay() {
      let minDay = this.myMin(
        ...this.filteredCovidData.map(e => e.slope.findIndex(f => f > 0))
      );
      if (isFinite(minDay) && !isNaN(minDay)) {
        return minDay;
      } else {
        return -1;
      }
    }
  },

  data: {
    paused: true,

    dataTypes: ["Casos Confirmados", "Muertes Reportadas"],

    selectedData: "Casos Confirmados",

    
    day: 7,
    
    icon: "icons/play.svg",
    
    sliderSelected: false,
    scale: ["Escala Logarítmica", "Escala Líneal"],
    selectedScale: "Escala Logarítmica",

    minCasesInCountry: 50,

    dates: [],

    parsedDates: [],

    covidData: [],

    countries: [],

    isHidden: true,

    selectedCountries: [
      "Argentina",
      // "Chile",
      // "Brasil",
      // "Uruguay",
      // "México",
      // "China",
      // // "Francia",
      // // "Alemania",
      // // "Irán",
      // "Italia",
      // "Japón",
      // "Corea del Sur",
      // "España",
      // "Estados Unidos",
      // "Reino Unido"
    ],

    graphMounted: false,

    autoplay: true
  }
});
