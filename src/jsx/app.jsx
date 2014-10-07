/** @jsx React.DOM */
;(function (window, React, $, Grapnel, undefined) {

  var $main = document.querySelector('.main'),
      $header = $('.header'),
      token = localStorage.accessToken,
      userId = localStorage.userId,
      timelineUrl = 'https://api.instagram.com/v1/users/self/feed?access_token=' + token,
      popularUrl = 'https://api.instagram.com/v1/media/popular/?access_token=' + token,
      loadOnScrollBottom = function(ctx, callback) {
        $(window).off('scroll');
        $(window).on('scroll', function() {
          if($(this).scrollTop() + $(this).height() == $(document).height()) {
            callback.call(ctx, ctx.state.pagination.next_url);
          }  
        });
      };

  /* === ROUTER START === */

  var Router = React.createClass({
    getInitialState: function () {
      return {component: <div/>}
    },
    componentDidMount: function () {
      var self = this;

      this.props.routes.forEach(function (route) {

        var url = route[0];
        var Component = route[1];

        var router = new Grapnel();
        router.get(url, function(req){
          self.setState({ 
            component: <Component params={req.params} /> 
          });    
        });

      });

    },
    render: function () {
      return this.state.component;
    }
  });

  /* === ROUTER END === */

  /* === TIMELINE COMPONENTS START === */

  var Timeline = React.createClass({
    getInitialState: function () {
      return {
        data: [],
        pagination: {}
      };
    },

    loadData: function (url) {
      $.ajax({
        url: url|| timelineUrl,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            data: this.state.data.concat(data.data),
            pagination: data.pagination
          });
        }.bind(this),
        error: function (err) {
          console.error(err);
        }.bind(this)
      });
    },

    componentDidMount: function () {
      this.loadData();
      
      loadOnScrollBottom(this, this.loadData);
    },

    render: function () {
      return (
        <div className="timeline">
          <TimelineList data={this.state.data} />
        </div>
      );
    }
  });

  var TimelineList = React.createClass({
    render: function () {
      var timelineitem = this.props.data.map(function (picture) {
        return(<TimelineItem element={picture} user={picture.user} id={picture.id} type={picture.type} />);
      });
      return (
        <ul className="feed">
          {timelineitem}
        </ul>
      );
    }
  });

  var TimelineItem = React.createClass({
    getInitialState: function () {
      return {
        liked: this.props.element.user_has_liked,
        likes: this.props.element.likes.count
      }
    },

    like: function () {
      var action = (this.state.liked) ? 'DELETE' : 'POST';

      // Make current type request
      $.ajax({
        type: 'GET',
        data: {
          "access_token": token,
          "photoId": this.props.id,
          "action": action
        },
        url: '/php/like.php',
        success: function () {
          // Change counter depending on request type
          if(this.state.liked){
            this.setState({liked: false, likes: this.state.likes - 1});
          } else {
            this.setState({liked: true, likes: this.state.likes + 1});
          }
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },

    render: function () {
      var element = (this.props.type === 'video') ? 
        <TimelineVideo src={this.props.element.videos.standard_resolution.url} id={this.props.id} /> : 
        <TimelinePhoto src={this.props.element.images.standard_resolution.url} id={this.props.id} liked={this.props.element.user_has_liked} makeLike={this.like} />; 

      return (
        <li className="feed__item">
          <TimelineUser 
            liked={this.state.liked} 
            userId={this.props.user.id} 
            username={this.props.user.username}
            avatar={this.props.user.profile_picture} 
            likes={this.state.likes}
            photoId={this.props.element.id}
            like={this.like}
          />
          <div className="photo">
            {element}
            <CommentsList comments={this.props.element.comments.data} />
          </div>
        </li>
      );
    }
  });

  var TimelineUser = React.createClass({
    render: function() {
      return (
        <div className="user g-clf">
          <a href={'/react/profile/' + this.props.userId} className="user__pic">
            <img src={this.props.avatar} />
          </a>
          <span className="user__name">{this.props.username}</span>
          <LikeHeart likes={this.props.likes} liked={this.props.liked} makeLike={this.props.like} />
        </div>
      );
    }
  });

  var LikeHeart = React.createClass({
    render: function () {
      return (
        <span className="user__likes">
          <i className={this.props.liked ? 'user__like user__like_liked' : 'user__like'} onClick={this.props.makeLike}></i>
          <span className="user__likes-count">{this.props.likes}</span>
        </span>
      );
    }
  });

  var TimelinePhoto = React.createClass({
    getInitialState: function () {
      return {liked: this.props.liked};
    },

    render: function () {
      return (
        <img className="photo__pic" id={this.props.id} src={this.props.src} onDoubleClick={this.props.makeLike} /> 
      );
    }
  });

  var TimelineVideo = React.createClass({
    render: function () {
      return (
        <video className="photo__pic" id={this.props.id} controls>
          <source src={this.props.src}></source>
        </video>
      );
    }
  });

  var CommentsList = React.createClass({
    render: function() {
      var comment = this.props.comments.map(function (comment) {
        return(<CommentsItem src={comment.from.profile_picture} authorId={comment.from.id} author={comment.from.username} text={comment.text} />);
      }); 
      return (
        <ul className="comments">
          {comment}
        </ul>
      );
    }
  });

  var CommentsItem = React.createClass({
    render: function() {
      return (
        <li className="comments__item">
          <img src={this.props.src} className="comments__pic" />
          <a className="comments__username" href="/react/profile/">{this.props.author}</a>:&#160;
          <span className="comments__text">{this.props.text}</span>
        </li>
      );
    }
  });

  /* === TIMELINE COMPONENTS END === */

  /* === SEARCH PHOTOS COMPONENTS START === */

  var SearchPhotos = React.createClass({
    getInitialState: function () {
      return {
        data: [],
        pagination: {},
        query: ''
      }
    },
    search: function (e) {
      e.preventDefault();
      var _this = this;
      $.ajax({
        url: 'https://api.instagram.com/v1/tags/' + _this.refs.searchInput.state.value + '/media/recent?&access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          if (data.meta.code === 200) {
            this.setState({
              data: data.data,
              pagination: data.pagination
            });
            loadOnScrollBottom(this, this.searchScrollBottom);
          } else {
            this.deniedTag();
          }
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    searchScrollBottom: function (url) {
      $.ajax({
        url: url,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            data: this.state.data.concat(data.data),
            pagination: data.pagination
          });
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    loadPopular: function (url) {
      $.ajax({
        url: url || popularUrl,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            data: this.state.data.concat(data.data),
            pagination: data.pagination
          });
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    deniedTag: function () {
      this.refs.searchInput.getDOMNode().style.border = '2px solid #f00';
      window.setTimeout(function () {
        this.refs.searchInput.getDOMNode().style.border = 'none';
      }.bind(this), 2000);
    },
    componentDidMount: function () {
      this.loadPopular();
      $(window).off('scroll');
    },
    render: function () {
      return (
        <div className="search">
          <form className="search__form" onSubmit={this.search}>
            <input type="text" defaultValue={this.state.query} ref="searchInput" className="search__input"  placeholder="Search photo by Hashtag"/>
          </form>
          <ResultList searchResult={this.state.data} />
        </div>
      );
    }
  });

  var ResultList = React.createClass({
    render: function () {
      var items = this.props.searchResult.map(function (photo) {
        return (
          <a className="photo-list__item fancybox" 
             href={photo.images.standard_resolution.url} 
             title={photo.caption && photo.caption.text || ''}>
            <img src={photo.images.standard_resolution.url} />
          </a>
        )
      });
      return (
        <div className="photo-list">
          {items}  
        </div>
      );
    }
  });

  /* === SEARCH PHOTOS COMPONENTS END === */
  
  /* === SEARCH USERS COMPONENTS START === */

  var SearchUsers = React.createClass({
    getInitialState: function () {
      return {
        data: [],
        query: ''
      }
    },
    search: function (e) {
      e.preventDefault();
      var _this = this;
      $.ajax({
        url: 'https://api.instagram.com/v1/users/search?q=' + _this.refs.searchInput.state.value + '&access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          if (data.meta.code === 200) {
            this.setState({
              data: data.data
            });
          }
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    render: function () {
      return (
        <div className="search">
          <form className="search__form" onSubmit={this.search}>
            <input type="text" defaultValue={this.state.query} ref="searchInput" className="search__input"  placeholder="Search by Username"/>
          </form>
          <PeopleList searchResult={this.state.data} />
        </div>
      );
    }
  });

  var PeopleList = React.createClass({
    render: function () {
      var items = this.props.searchResult.map(function (photo) {
        return (
          <a className="photo-list__item fancybox" 
             href={'#/profile/' + photo.id} 
             title={photo.username || ''}>
            <img src={photo.profile_picture} />
          </a>
        )
      });
      return (
        <div className="photo-list">
          {items}  
        </div>
      );
    }
  });

  /* === SEARCH USERS COMPONENTS END === */
  
  /* === 404 COMPONENTS END === */

  var PageNotFound = React.createClass({
    render: function () {
      return (
        <div>Page not found</div>
      );
    }
  });

  /* === 404 COMPONENTS END === */
  
  /* === PROFILE COMPONENTS START === */
  
  var Profile = React.createClass({
    getInitialState: function () {
      return {
        user: {},
        counts: {},
        photos: [],
        pagination: {}
      }
    },
    getProfileData: function () {
      $.ajax({
        url: 'https://api.instagram.com/v1/users/' + this.props.params.id + '?access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            user: data.data,
            counts: data.data.counts
          });
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      })
    },
    getProfilePhotos: function (url) {
      $.ajax({
        url: url || 'https://api.instagram.com/v1/users/' + this.props.params.id + '/media/recent?access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            photos: this.state.photos.concat(data.data),
            pagination: data.pagination
          });
          loadOnScrollBottom(this, this.getProfilePhotos)
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    componentDidMount: function () {
      this.getProfileData();
      this.getProfilePhotos();
      $header.find('.profile__link_followers').on('click', function (e) {
        e.preventDefault();
        page(this.getAttribute('href'));
      });
    },
    render: function () {
      var photos = this.state.photos.map(function (photo) {
        return (
          <div className="photo-list__item">
            <a className="fancybox" href={photo.images.standard_resolution.url}>
              <img src={photo.images.low_resolution.url} title={photo.caption && photo.caption.text || ''} />
            </a>
            <ProfileLikeCounter count={photo.likes.count} state={photo.user_has_liked} id={photo.id} />
          </div>
        );
      });
      return (
        <div className="profile">
          <div className="profile__data">
            <div className="profile__photo">
              <img src={this.state.user.profile_picture} alt={this.state.user.username} className="profile__picture"/>
            </div>
            <div className="profile__username">{this.state.user.username}</div>
            <ul className="profile__stats">
              <li className="profile__item">
                <span className="profile__count">Photos</span><br />
                <span className="profile__media-digits">{this.state.counts.media}</span>
              </li>
              <li className="profile__item">
                <a className="profile__link_followers" href={'/react/profile/' + this.state.user.id + '/followed-by/'}>
                  <span className="profile__count">Followers</span><br />
                  <span className="profile__followed_by-digits">{this.state.counts.followed_by}</span>
                </a>
              </li>
              <li className="profile__item">
                <a className="profile__link_followers" href={'/react/profile/' + this.state.user.id + '/follows/'}>
                  <span className="profile__count profile__count_follow">Follow</span><br />
                  <span className="profile__follows-digits">{this.state.counts.follows}</span>
                </a>
              </li>
            </ul>
            <ul className="profile__info">
              <li className="profile__item">{this.state.user.full_name}</li>
              <li className="profile__item">{this.state.user.bio}</li>
              <li className="profile__item">
                <a href={this.state.user.website} target="_blank" className="profile__url">
                  {this.state.user.website}
                </a>
              </li>
            </ul>
          </div>
          <div className="photo-list">
            {photos}
          </div>
        </div>
      );
    }
  });

  var ProfileLikeCounter = React.createClass({
    getInitialState: function () {
      return {
        likes: this.props.count,
        liked: this.props.state
      };
    },
    like: function () {
      TimelineItem.prototype.type.prototype.like.call(this);
    },
    render: function () {
      return (
        <span className="photo-list__likes" onClick={this.like}>Likes: {this.state.likes}</span>
      );
    }
  });

  /* === PROFILE COMPONENTS END === */
  
  /* === ABOUT COMPONENTS START === */
  
  var About = React.createClass({
    render: function () {
      return (
        <div>About</div>
      );
    }
  });

  /* === ABOUT COMPONENTS END === */
  
  /* === FOLLOWERS COMPONENTS START === */
  
  var Followers = React.createClass({
    getInitialState: function () {
      return {
        followers: [],
        pagination: {}
      }
    },
    getFollowers: function (url) {
      $.ajax({
        url: url || 'https://api.instagram.com/v1/users/' + this.props.params.id + '/' + this.props.params.method + '?access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({
            followers: this.state.followers.concat(data.data),
            pagination: data.pagination
          });
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      })
    },
    componentDidMount: function () {
      this.getFollowers();
      loadOnScrollBottom(this, this.getFollowers);
    },
    render: function () {
      var followers = this.state.followers.map(function(follower) {
        return (
          <div className="follow__item">
            <a href={'/react/profile/' + follower.id + '/'}>
              <img className="follow__avatar" src={follower.profile_picture} />
              <span className="follow__username">@{follower.username}</span>
            </a>
            <RelationshipButton id={follower.id} />
          </div>
        );
      });
      return (
        <div className="follow">
          <header className="follow__header">{this.props.params.method === 'follows' && 'Follows' || 'Followers'}</header>
          <div className="follow__list">
            {followers}
          </div>
        </div>
      );
    }
  });

  var RelationshipButton = React.createClass({
    getInitialState: function () {
      return {status: ''}
    },
    getRelationshipStatus: function (follower, callback) {
      $.ajax({
        url: 'https://api.instagram.com/v1/users/' + this.props.id + '/relationship?access_token=' + token,
        dataType: 'jsonp',
        success: function (data) {
          this.setState({status: data.data.outgoing_status});
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    changeRelationship: function () {
      $.ajax({
        url: '/php/followMe.php',
        dataType: 'json',
        data: {
          action: this.state.status === 'none' ? 'follow' : 'unfollow', 
          access_token: token, 
          userId: this.props.id
        },
        success: function (data) {
          this.setState({status: data.data.outgoing_status});
        }.bind(this),
        error: function (err) {
          console.error(err);
        }
      });
    },
    componentDidMount: function () {
      this.getRelationshipStatus();
    },
    render: function () {
      return (
        <button 
          className={'follow__btn ' + (this.state.status === 'none' ? 'follow__btn_read' : 'follow__btn_unread' )} 
          onClick={this.changeRelationship}>
          {this.state.status === 'none' ? 'Follow' : 'Unfollow'}
        </button>
      );
    }
  });

  /* === FOLLOWERS COMPONENTS END === */
  
  /* === MENU COMPONENTS START === */

  var Menu = React.createClass({
    render: function () {
      var links = this.props.links.map(function (link) {
        return (<li className="menu__item"><a className="menu__link" href={(link[1] === 'Profile') ? link[0] + userId + '/' : link[0]}>{link[1]}</a></li>);
      });
      return (
        <ul className="menu g-clf">
          {links}
        </ul>
      ); 
    }
  });

  /* === MENU COMPONENTS END === */

  var routes = [
    ['/', Timeline],
    ['/search/photos/?', SearchPhotos],
    ['/search/users/?', SearchUsers],
    ['/profile/:id/?', Profile],
    ['/profile/:id/:method/?', Followers],
    ['/about/', About]
  ];

  var links = [
    ['#/', 'Timeline'],
    ['#/search/photos/', 'Photos'],
    ['#/search/users/', 'People'],
    ['#/profile/', 'Profile'],
    ['#/about/', 'About']
  ];

  React.renderComponent(<Menu links={links} />, $header[0]);
  React.renderComponent(<Router routes={routes} />, $main);

}(window, window.React, window.jQuery, window.Grapnel));