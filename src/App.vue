<template>
  <div id="root">
      <Graph v-if="covidData.length > 0" :data="filteredCovidData" :dates="dates" :parsed-dates="parsedDates" :day.sync="day" :selected-data="selectedData" :scale="selectedScale" :resize="isHidden" @graph-mounted="graphMounted = true"></Graph>
      <div id="nav">
        <div class="navelement">
          <img v-if="paused" @click="play" src="icons/play.svg" style="width: 3rem;">
          <img v-if="!paused" @click="play" src="icons/pause.svg" style="width: 3rem;">
        </div>
        <div class="navelement">
          <h2>{{minDay > 0 ? parsedDates[day - 1] : parsedDates[parsedDates.length - 1] }}</h2>
        </div>
        <div class="navelement" id="slidercontainer">
          <input v-if="dates.length > 7" type="range" :min="minDay > 0 ? minDay : dates.length" :max="dates.length" step="1" v-model="day" id="slider" @mousedown="pause"></input>
        </div>
        <div class="navelement">
          <select v-model="selectedScale" @mousedown="pause">
            <option v-for="(s, i) in scale" v-bind:value="s" :key="i">
              {{ s }}
            </option>
          </select>
        </div>
      </div>
    </div>
</template>

<script>
import Graph from '@/components/Graph.vue'

export default {
  name: 'App',
  components: {
    Graph
  },

  mounted() {
    this.pullData(this.selectedData);
  },

  created() {
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

  data() {
    return {
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
    };
  }
}
</script>

<style>

body {
  font-family: "Gotham", sans-serif;
  font-size: 1em;
  line-height: 1.5;
  font-weight: 400;
  color: #14273c;

  text-rendering: optimizeLegibility;
}

h1 {
  margin: 0px; /* was 20 px */
  /*
  text-align:center;*/
  font-weight: 100;
  font-size: 2rem;
}

h2 {
  margin: 0px;
  font-weight: 600;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  font-family: 'Gotham', sans-serif;
}

h3 {
  text-align: center;
  font-weight: 400;
  font-size: 1.2rem;
}

h1,
h2,
h3 {
  line-height: 1.1;
}

b {
  font-weight: bold;
}

i {
  font-style: italic;
}

p {
  font-size: 1rem;
}

#root {
  height: 100%;
  display: flex;
  flex-direction: column;
}

#nav {
  display: flex;
  flex-direction: row;
}

.navelement {
  padding: 1rem;
  text-align: center;
  margin: auto;
}

.navelement > h2 {
  margin-bottom: 0;
  margin: auto;
}

#slidercontainer {
  flex-grow: 1;
}

#slider {
  width: 100%;
  min-width: 200px;
}

svg {
  fill: #68bbe8;
}

select {
  min-width: 12rem;
  font-size: 1rem;
  padding: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;
}

select:first-child {
  margin-top: 0;
}

.js-plotly-plot .plotly .main-svg {
    position: absolute;
    top: 0px;
    left: 0px;
    pointer-events: none;
}

.js-plotly-plot .plotly .modebar {
    position: absolute;
    top: 2px;
    right: 2px;
}

.modebar-container{
    position: absolute;
    top: 0px;
    right: 0px;
    width: 100%;
}

.js-plotly-plot .plotly .modebar-group {
    float: left;
    display: inline-block;
    box-sizing: border-box;
    padding-left: 8px;
    position: relative;
    vertical-align: middle;
    white-space: nowrap;
}

.js-plotly-plot .plotly .modebar--hover > :not(.watermark) {
    opacity: 0;
    transition: opacity 0.3s ease 0s;
}

.js-plotly-plot .plotly .modebar-btn {
    position: relative;
    font-size: 16px;
    height: 22px;
    cursor: pointer;
    line-height: normal;
    box-sizing: border-box;
    padding: 3px 4px;
}

.js-plotly-plot .plotly a {
    text-decoration: none;
}
</style>
