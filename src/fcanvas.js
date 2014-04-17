goog.provide('Fcanvas');

goog.scope(function() {

/**
 * @constructor
 * // 継承していないが、CanvasRenderingContext2D のメソッドを受けるために偽装する
 * @extends {CanvasRenderingContext2D}
 */
Fcanvas = function() {
  /** @type {Array.<number>} */
  this.sequence = [];
  /** @type {number} */
  this.pos = 0;
  /** @type {function(CanvasRenderingContext2D)} */
  this.drawFunction;
};

/**
 * メソッドテーブル
 * @type {!Object.<string, number>}
 */
Fcanvas.MethodTable = { // 0x00-0x7f
  // state 0x00-0x0f
  save: 0x00,
  restore: 0x01,

  // path 0x10-0x1f
  beginPath: 0x10,
  closePath: 0x11,

  // line 0x20-0x2f
  lineTo: 0x20,
  bezierCurveTo: 0x21,
  arc: 0x22,
  arcTo: 0x23,

  // move 0x30-0x3f
  moveTo: 0x30,

  // draw 0x70-0x7f
  stroke: 0x70,
  fill: 0x71,
  strokeRect: 0x72,
  fillRect: 0x73,
  clearRect: 0x7f
};

/**
 * プロパティテーブル
 * @type {!Object.<string, number>}
 */
Fcanvas.PropertyTable = { // 0x80-0xff
  // line 0x80-0x8f
  lineWidth: 0x80,
  lineCap: 0x81,
  lineJoin: 0x82,
  miterLimit: 0x83,

  // style 0x90-0x9f
  strokeStyle: 0x90,
  fillStyle: 0x91,

  // global
  globalAlpha: 0xa0,
  globalCompositeOperation: 0xa1,

  // shadow
  shadowColor: 0xb0,
  shadowOffsetX: 0xb1,
  shadowOffsetY: 0xb2,
  shadowBlur: 0xb3,

  // text
  font: 0xc0,
  textAlign: 0xc1,
  textBaseline: 0xc2
};

/**
 * 中間形式のidからメソッド名への変換テーブル.
 * @type {Array.<string>}
 */
Fcanvas.ReverseMethodTable = (
  /**
   * メソッドテーブルから prototype にメソッド追加.
   * @param {!Object.<string, number>} table
   * @return {Array.<string>}
   */
  function(table) {
    /** @type {Array.<string>} */
    var reverseTable = new Array(128); // 0x00-0x7f
    /** @type {Array.<string>} */
    var keys = Object.keys(table);
    /** @type {string} */
    var key;
    /** @type {number} */
    var value;
    /** @type {number} */
    var i;
    /** @type {number} */
    var il;

    // create reverse table, prototype functions
    for (i = 0, il = keys.length; i < il; ++i) {
      key = keys[i];
      value = table[key];
      reverseTable[value] = key;

      Fcanvas.prototype[key] = (function(methodName, methodId) {
        return function() {
          /** @type {number} */
          var pos = this.pos;
          /** @type {number} */
          var i;
          /** @type {number} */
          var il;

          // type
          this.sequence[pos++] = methodId;
          // length
          this.sequence[pos++] = arguments.length;
          // arguments
          for (i = 0, il = arguments.length; i < il; ++i) {
            this.sequence[pos++] = arguments[i];
          }

          this.pos = pos;
        };
      })(key, value);
    }

    return reverseTable;
  }
)(Fcanvas.MethodTable);

/**
 * 中間形式のidからプロパティ名への変換テーブル.
 * @type {Array.<string>}
 */
Fcanvas.ReversePropertyTable = (
  /**
   * プロパティテーブルからプロパティ名の setter/getter を登録.
   * @param {!Object.<string, number>} table
   * @return {Array.<string>}
   */
  function(table) {
    /** @type {Array.<string>} */
    var reverseTable = new Array(128); // 0x80-0xff
    /** @type {Array.<string>} */
    var keys = Object.keys(table);
    /** @type {string} */
    var key;
    /** @type {number} */
    var value;
    /** @type {number} */
    var i;
    /** @type {number} */
    var il;

    // create reverse table, prototype properties
    for (i = 0, il = keys.length; i < il; ++i) {
      key = keys[i];
      value = table[key] & 0x7f;
      reverseTable[value] = key;

      Object.defineProperty(Fcanvas.prototype, key, {
        set: (function(propertyName, methodId) {
          return function(value) {
            // type
            this.sequence[this.pos++] = methodId;
            // length
            this.sequence[this.pos++] = 1;
            // arguments
            this.sequence[this.pos++] = value;

            // 描画状態のスタックで使用するため記録しておく
            this[propertyName + '_'] = value;
          };
        })(key, value | 0x80),
        get: (function(propertyName) {
          return function() {
            return this[propertyName + '_'];
          }
        })(key)
      });
    }

    return reverseTable;
  }
)(Fcanvas.PropertyTable);

/**
 * @param {CanvasRenderingContext2D} ctx target context
 */
Fcanvas.prototype.draw = function(ctx) {
  /** @type {Array.<number>} */
  var sequence = this.sequence;
  /** @type {number} */
  var id;
  /** @type {number} */
  var length;
  /** @type {Array.<number>} */
  var args;
  /** @type {string} */
  var name;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = this.pos; i < il;) {
    id = sequence[i++];
    length = sequence[i++];
    args = sequence.slice(i, i += length);

    // method call
    if (id < 0x80) {
      name = Fcanvas.ReverseMethodTable[id];
      ctx[name].apply(ctx, args);
      // property set
    } else {
      name = Fcanvas.ReversePropertyTable[id & 0x7f];
      ctx[name] = args[0];
    }
  }
};

/**
 * 描画 function の生成.
 * @return {function(CanvasRenderingContext2D)}
 */
Fcanvas.prototype.createDrawFunction = function() {
  /** @type {Array.<string>} */
  var funcstr = "";
  /** @type {Array.<number>} */
  var sequence = this.sequence;
  /** @type {number} */
  var id;
  /** @type {number} */
  var length;
  /** @type {Array.<number>} */
  var args;
  /** @type {string} */
  var name;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = this.pos; i < il;) {
    id = sequence[i++];
    length = sequence[i++];
    args = sequence.slice(i, i += length);

    // method call
    if (id < 0x80) {
      name = Fcanvas.ReverseMethodTable[id];
      funcstr += "ctx." + name + "(" + args.join(",") + ");";
      // property set
    } else {
      name = Fcanvas.ReversePropertyTable[id & 0x7f];
      funcstr += "ctx." + name + "=" + args[0] + ";";
    }
  }

  this.drawFunction = new Function("ctx", funcstr);

  return this.drawFunction;
};


// end of scope
});