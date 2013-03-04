'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    jshint: {
      options: {
        forin: true,
        noarg: true,
        noempty: true,
        eqeqeq: true,
        strict: true,
        undef: true,
        trailing: true,
        unused: true,
        indent: 2
      },
      with_node_options: {
        options: {
          node: true
        },
        files: {
          src: ['Gruntfile.js', 'app.js', 'lib/**/*.js']
        }
      },
      with_mocha_globals: {
        options: {
          node: true,
          globals: {
            describe: true,
            it: true,
            beforeEach: true,
            afterEach: true
          }
        },
        files: {
          src: ['test/**/*.js']
        }
      },
      with_browser_options: {
        options: {
          browser: true,
          expr: true,
          devel: true,
          globals: {
            io: true
          }
        },
        files: {
          src: ['public/*.js', '!public/html5slider.js']
        }
      }
    },
    simplemocha: {
      all: { src: 'test/**/*.js' }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.registerTask('default', ['jshint', 'simplemocha']);
};
