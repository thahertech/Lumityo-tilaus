const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const NOW = Date.parse('2026-01-15T10:20:00Z');
const HOUR = 60 * 60 * 1000;

function xml(rows) {
  return `<wfs:FeatureCollection xmlns:wfs="wfs" xmlns:BsWfs="fmi">${rows.map(([time, name, value]) =>
    `<wfs:member><BsWfs:BsWfsElement><BsWfs:Time>${new Date(time).toISOString()}</BsWfs:Time><BsWfs:ParameterName>${name}</BsWfs:ParameterName><BsWfs:ParameterValue>${value}</BsWfs:ParameterValue></BsWfs:BsWfsElement></wfs:member>`
  ).join('')}</wfs:FeatureCollection>`;
}

function loadWeather(fetch = () => { throw new Error('unexpected fetch'); }) {
  let now = NOW;
  const timers = [];
  class Clock extends Date {
    static now() { return now; }
  }
  const source = fs.readFileSync(path.join(__dirname, '../utils/ouluWeather.js'), 'utf8');
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const context = {
    exports: {}, require, fetch, Date: Clock, AbortController,
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { timer.cleared = true; },
  };
  vm.runInNewContext(code, context);
  return { ...context.exports, setNow: (value) => { now = value; }, timers };
}

test('parses the nearest forecast and distinguishes future snow from current conditions', () => {
  const { parseOuluForecast } = loadWeather();
  const result = parseOuluForecast(xml([
    [NOW - 20 * 60000, 'temperature', '-2.2'],
    [NOW - 20 * 60000, 'WeatherSymbol3', '3.0'],
    [NOW + 40 * 60000, 'temperature', '-3'],
    [NOW + 40 * 60000, 'WeatherSymbol3', '51'],
  ]), NOW);
  assert.equal(result.days[0].temperature, -2);
  assert.equal(result.days[0].description, 'pilvistä');
  assert.equal(result.days[0].snow, false);
  assert.deepEqual(Array.from(result.days[0].snowTimes), [NOW + 40 * 60000]);
  assert.equal(result.days[0].time, NOW - 20 * 60000);

  const snow = parseOuluForecast(xml([
    [NOW, 'temperature', '-0.2'], [NOW, 'WeatherSymbol3', '42'],
    [NOW + HOUR, 'WeatherSymbol3', '52'],
  ]), NOW);
  assert.equal(snow.days[0].temperature, 0);
  assert.equal(snow.days[0].icon, 'snow-outline');
  assert.equal(snow.days[0].snow, true);
  assert.deepEqual(Array.from(snow.days[0].snowTimes), [NOW, NOW + HOUR]);
});

test('represents rain, sleet and missing or unknown conditions honestly', () => {
  const { describeWeather, parseOuluForecast } = loadWeather();
  assert.equal(describeWeather(32).description, 'vesisadetta');
  assert.equal(describeWeather(82).description, 'räntäsadetta');
  assert.equal(describeWeather(99).description, 'säätila ei tiedossa');
  const result = parseOuluForecast(xml([
    [NOW, 'temperature', '5'], [NOW, 'WeatherSymbol3', 'NaN'],
    [NOW + 13 * HOUR, 'WeatherSymbol3', '51'],
  ]), NOW);
  assert.equal(result.days[0].description, 'säätila ei tiedossa');
  assert.deepEqual(Array.from(result.days[0].snowTimes), []);
});

test('finds snowfall on each Oulu day even when the displayed hour is clear', () => {
  const { parseOuluForecast } = loadWeather();
  const now = Date.parse('2026-01-14T22:30:00Z');
  const result = parseOuluForecast(xml([
    [Date.parse('2026-01-14T22:00:00Z'), 'temperature', '-2'],
    [Date.parse('2026-01-14T22:00:00Z'), 'WeatherSymbol3', '3'],
    [Date.parse('2026-01-15T21:00:00Z'), 'WeatherSymbol3', '51'],
    [Date.parse('2026-01-16T04:00:00Z'), 'WeatherSymbol3', '42'],
    [Date.parse('2026-01-16T10:00:00Z'), 'temperature', '0'],
    [Date.parse('2026-01-16T10:00:00Z'), 'WeatherSymbol3', '3'],
    [Date.parse('2026-01-16T21:00:00Z'), 'WeatherSymbol3', '52'],
    [Date.parse('2026-01-17T02:00:00Z'), 'WeatherSymbol3', '43'],
    [Date.parse('2026-01-18T02:00:00Z'), 'WeatherSymbol3', '53'],
  ]), now);
  assert.deepEqual(Array.from(result.days[0].snowTimes), [Date.parse('2026-01-15T21:00:00Z')]);
  assert.deepEqual(Array.from(result.days[1].snowTimes), [
    Date.parse('2026-01-16T04:00:00Z'), Date.parse('2026-01-16T21:00:00Z'),
  ]);
  assert.deepEqual(Array.from(result.days[2].snowTimes), [Date.parse('2026-01-17T02:00:00Z')]);
  assert.equal(result.days[1].description, 'pilvistä');
  assert.equal(result.days[2].temperature, null);
});

test('does not report snow from earlier today or treat rain and sleet as snow', () => {
  const { parseOuluForecast } = loadWeather();
  const result = parseOuluForecast(xml([
    [NOW, 'temperature', '1'], [NOW, 'WeatherSymbol3', '3'],
    [NOW - 3 * HOUR, 'WeatherSymbol3', '51'],
    [NOW + HOUR, 'WeatherSymbol3', '32'],
    [NOW + 2 * HOUR, 'WeatherSymbol3', '82'],
  ]), NOW);
  assert.deepEqual(Array.from(result.days[0].snowTimes), []);
});

test('selects Oulu calendar days and noon forecasts across daylight saving time', () => {
  const { parseOuluForecast } = loadWeather();
  const now = Date.parse('2026-03-28T21:30:00Z');
  const result = parseOuluForecast(xml([
    [Date.parse('2026-03-28T21:00:00Z'), 'temperature', '-2'],
    [Date.parse('2026-03-28T22:00:00Z'), 'temperature', '20'],
    [Date.parse('2026-03-29T08:00:00Z'), 'temperature', '1'],
    [Date.parse('2026-03-29T09:00:00Z'), 'temperature', '3'],
    [Date.parse('2026-03-29T09:00:00Z'), 'WeatherSymbol3', '51'],
    [Date.parse('2026-03-30T09:00:00Z'), 'temperature', '4'],
    [Date.parse('2026-03-30T09:00:00Z'), 'WeatherSymbol3', '3'],
  ]), now);
  assert.deepEqual(Array.from(result.days, (day) => day.dateKey), ['2026-03-28', '2026-03-29', '2026-03-30']);
  assert.deepEqual(Array.from(result.days, (day) => day.temperature), [-2, 3, 4]);
  assert.equal(result.days[1].description, 'lumisadetta');
});

test('keeps missing midday forecasts distinct from temperatures at unrelated times', () => {
  const { parseOuluForecast } = loadWeather();
  const result = parseOuluForecast(xml([
    [NOW, 'temperature', '1'],
    [Date.parse('2026-01-16T04:00:00Z'), 'temperature', '-8'],
    [Date.parse('2026-01-17T10:00:00Z'), 'temperature', '2'],
  ]), NOW);
  assert.equal(result.days[1].temperature, null);
  assert.equal(result.days[1].time, null);
  assert.equal(result.days[2].temperature, 2);
});

test('rejects invalid XML, bad temperatures and forecasts outside the valid window', () => {
  const { parseOuluForecast } = loadWeather();
  for (const value of [
    '<invalid>', '<!DOCTYPE xml><xml/>', '<Exception/>',
    xml([[NOW, 'temperature', 'NaN']]),
    xml([[NOW, 'temperature', '']]),
    xml([[NOW - 2 * HOUR, 'temperature', '-1']]),
    xml([[NOW + 2 * HOUR, 'temperature', '-1']]),
  ]) {
    assert.throws(() => parseOuluForecast(value, NOW));
  }
});

test('caches and shares successful requests, uses a bounded Oulu query, and refreshes after expiry', async () => {
  let count = 0;
  let url;
  const weather = loadWeather(async (request) => {
    count += 1;
    url = request;
    return { ok: true, text: async () => xml([[NOW, 'temperature', '-1'], [NOW, 'WeatherSymbol3', '1']]) };
  });
  const [first, second] = await Promise.all([weather.getOuluForecast(), weather.getOuluForecast()]);
  assert.equal(count, 1);
  assert.equal(first, second);
  assert.equal(await weather.getOuluForecast(), first);
  const query = new URL(url).searchParams;
  assert.equal(query.get('place'), 'Oulu');
  assert.equal(query.get('parameters'), 'temperature,WeatherSymbol3');
  assert.equal(query.get('storedquery_id'), 'fmi::forecast::edited::weather::scandinavia::point::simple');
  assert.equal(Date.parse(query.get('endtime')) - Date.parse(query.get('starttime')), 73 * HOUR);
  assert.equal(weather.timers[0].delay, 10000);
  assert.equal(weather.timers[0].cleared, true);
  weather.setNow(NOW + 31 * 60000);
  await weather.getOuluForecast();
  assert.equal(count, 2);
});

test('failed requests propagate, do not poison the cache, and can be retried', async () => {
  let count = 0;
  const weather = loadWeather(async () => {
    count += 1;
    return count === 1 ? { ok: false, status: 503 } : {
      ok: true, text: async () => xml([[NOW, 'temperature', '1']]),
    };
  });
  await assert.rejects(weather.getOuluForecast(), /503/);
  assert.equal((await weather.getOuluForecast()).days[0].temperature, 1);
  assert.equal(count, 2);
});

test('refreshes the three calendar days after midnight in Oulu', async () => {
  const beforeMidnight = Date.parse('2026-01-15T21:55:00Z');
  let count = 0;
  const weather = loadWeather(async () => {
    count += 1;
    return {
      ok: true,
      text: async () => xml([
        [Date.parse('2026-01-15T21:00:00Z'), 'temperature', '-2'],
        [Date.parse('2026-01-15T22:00:00Z'), 'temperature', '-3'],
      ]),
    };
  });
  weather.setNow(beforeMidnight);
  assert.equal((await weather.getOuluForecast()).days[0].dateKey, '2026-01-15');
  weather.setNow(beforeMidnight + 10 * 60000);
  assert.equal((await weather.getOuluForecast()).days[0].dateKey, '2026-01-16');
  assert.equal(count, 2);
});

test('aborts a timed-out request and permits retry', async () => {
  const weather = loadWeather((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const request = weather.getOuluForecast();
  weather.timers[0].callback();
  await assert.rejects(request, /aborted/);
  assert.equal(weather.timers[0].cleared, true);
});
