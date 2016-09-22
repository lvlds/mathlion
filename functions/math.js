var alter = require('../../../src/core_plugins/timelion/server/lib/alter.js');
var Chainable = require('../../../src/core_plugins/timelion/server/lib/classes/chainable');
var _ = require('lodash');
var math = require('mathjs');
var mathenviroment = require('./enviroment/math-enviroment');

module.exports = new Chainable('math', {
  args: [
    {
      name: 'inputSeries',
      types: ['seriesList']
    },
    {
      name: 'function',
      types: ['string'],
      help: 'The function to evaluate. Use \"source\" to refer to the preceding chainable'
    },
    {
      name: 'label',
      types: ['string', 'null']
    }
  ],
  help: 'Advanced math parsing',
  fn: function mathChain(args, tlConfig) {
    var envName = tlConfig.server._sources[0]._requestCounter.value + ' '; //Name of the enviroment (# of the request)

    var target = tlConfig.getTargetSeries(); //target series
    var inputequation = args.byName.function; //equation to evaluate
    var label = args.byName.label; //label for the plot

    //initiate mathematical environment (scope)
    if(!mathenviroment.exists(envName)){
      mathenviroment.initSubEnviroment(envName);
    }
    mathenviroment.updateRequest(envName);

    /*
    Evaluate the user's input string
    If the function is expected to be plotted return the result
    Else, if the user it's just doing math, return the original datasource array
    */
    function evaluate(equation,scope) {
      /*
      Parse and elaborate the string to convert normal operators to vector operators
      Prevent various problems with numbers formatting
      */
      var vectoreq = equation.split('*').join('.*').split('/').join('./').split('^').join('.^');
      vectoreq = vectoreq.split('..*').join('.*').split('../').join('./').split('..^').join('.^');
      var isAssign = (vectoreq.split(';').slice(-1)[0].indexOf('=') != -1); //check if eachseries is being elaborated
      var evaluated = math.eval(vectoreq,scope);//evaluate the new value/function in the scope
      
      //In case of single value result of elaboration an horizontal line is plotted with the said value
      if(math.typeof(evaluated) == 'number' && !isAssign) {
        var x = new Array(scope['this'].length).fill(evaluated);
        evaluated = x;
      }
      return (isAssign) ? scope['this'] : evaluated;//return the correct thing to display

    }

    return alter(args, function (eachSeries) {
      var times = _.map(eachSeries.data, 0); //x axis
      var val = _.map(eachSeries.data, 1); //y axis

      mathenviroment.setScope(envName,{'source':val}); //add source to the enviroment

      //evaluate the input equation inside the updated scope
      var values = evaluate(inputequation,mathenviroment.getScope(envName));

      eachSeries.data = _.zip(times, values); //update series with new values

      //pretty print equation to string (for the axis label)
      var eq = inputequation.split('source').join(eachSeries.label);
      eachSeries.label = label != null ? label : eq;
      return eachSeries;
    });
  }
});
