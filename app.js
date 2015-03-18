(function (w, d, n, M, _, $, B) {
  'use strict';

  var jsonPath = './app.json';

  var questionTmpl = _.template([
    '<section id="question" class="question">',
      '<h1 class="question__subject">',
        '<i class="fa fa-question-circle fa-5x"></i>',
        '<span><%= subject %></span>',
      '</h1>',
      '<form>',
        '<ul class="question__list">',
          '<% _.each(answers, function (answer, i) { %>',
            '<li class="question__list__item">',
              '<label>',
                '<input type="<%= answer.type %>" name="<%= answer.name %>" value="<%= answer.value %>" data-id="<%= answer.id %>">',
                '<span><%= answer.text %></span>',
              '</label>',
            '</li>',
          '<% }); %>',
        '</ul>',
        '<button class="question__button" disabled="true">',
          '<span>次へ進む</span>',
          '<i class="fa fa-hand-o-right fa-2x"></i>',
        '</button>',
      '</form>',
    '</section>'
  ].join(''));

  var resultTmpl = _.template([
    '<h1><%= text %></h1>',
  ].join(''));

  var bindEachInputUpdate = function ($inputs) {
    $inputs.on('change', function (ev) {
      $inputs.each(function (i, el) { $(el).trigger('update'); });
    });
  };

  var unbindEachInputUpdate = function ($inputs) {
    $inputs.off('change update');
  };

  var updateSessionStorage = function (key, value) {
    w.sessionStorage.setItem(key, w.JSON.stringify(value));
  };

  var updateLocalStorage = function (key, value) {
    w.localStorage.setItem(key, w.JSON.stringify(value));
  };

  var jsonLoad = B.fromPromise($.ajax(jsonPath, { dataType: 'json' }));
  var contentLoad = B.fromCallback(function (cb) { $(d).ready(cb); });

  var ready = B.combineWith(function (content, json) { return json }, contentLoad, jsonLoad);

  ready.onValue(function (json) {
    //console.log(json);

    var $main = $('#main');

    var currentResult = new B.Bus();
    var currentQuestion = new B.Bus();

    var results = currentResult.scan([], function (prev, next) { return _.union(prev, next); });

    currentQuestion.onValue(function (question) {
      unbindEachInputUpdate($('.question__list__item input'));
      $main.html(questionTmpl(question));
      bindEachInputUpdate($('.question__list__item input'));

      var itemStates = [];

      $main.find('.question__list__item input').each(function (i, el) {
        var $input = $(el);
        var update = $input.asEventStream('update');
        var itemState = update.map(function (ev) {
          var $el = $(ev.target);
          return { id: $el.data('id'), parent_id: question.id, value: $el.val(), checked: $el.prop('checked') };
        }).toProperty({ id: undefined, parent_id: undefined, value: undefined, checked: false });
        itemStates.push(itemState);
      });

      var answers = B.combineAsArray(itemStates).map(function (items) { return _.where(items, { checked: true }) });

      var $button = $main.find('.question__button');
      var buttonClick = $button.asEventStream('click').doAction('.preventDefault');

      var buttonEnabled = answers.map(function (items) {
        var currentAnswers = _.where(items, { parent_id: question.id });
        return (0 < currentAnswers.length);
      }).toProperty(false);

      var button = B.combineWith(function (enabled, click, items, prevItems) {
        if (enabled) return { id: question.next_id, answers: items };
        return undefined;
      }, buttonEnabled, buttonClick, answers);

      buttonEnabled.assign(function ($el, enabled) { $el.attr('disabled', !enabled); }, $button);

      button.onValue(function (resp) {
        if (!resp) return;
        if (resp.answers) currentResult.push(resp.answers);
        if (resp.id) currentQuestion.push(_.where(json.questions, { id: resp.id })[0]);
      });

      //answers.log();
      //button.log();
    });

    results.onValue(function (answers) {
      //console.log(answers);

      var sum = _.chain(answers)
        .pluck('value')
        .reduce(function (sum, value) { return w.parseInt(sum) + w.parseInt(value);  })
        .value();

      var filterResult = function (result) {
        var matched = _.chain(result.relations)
          .map(function (num) { return (num === sum); })
          .filter(function (bool) { return (true === bool); })
          .value()[0];
        if (matched) return result;
        return undefined;
      };

      var matchedResult = _.chain(json.results)
        .map(filterResult)
        .filter(_.isObject)
        .value()[0];

      if (!matchedResult) return;

      $main.html(resultTmpl(matchedResult));
    });

    currentQuestion.push(_.where(json.questions, { id: json.questions[0].id })[0]);

    //currentResult.log();
    //currentQuestion.log();
  });

})(window, document, navigator, Modernizr, _, jQuery, Bacon);
