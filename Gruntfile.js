module.exports = function(grunt) {
  grunt.initConfig({
    jshint: {
      with_node_options: {
        options: {
          node: true
        },
        files: {
          src: ['Gruntfile.js', 'app.js', 'lib/**/*.js', 'test/**/*.js']
        }
      },
      with_browser_options: {
        options: {
          browser: true
        },
        files: {
          src: ['public/**/*.js']
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
