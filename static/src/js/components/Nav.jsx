import React from "react";
import settingsStore from '../stores/SettingsStore';
import * as SearchActions from '../actions/SearchActions';
import * as SettingsActions from '../actions/SettingsActions';
import * as BS from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import * as _ from 'lodash'
import {connect} from 'react-redux'

class Nav extends React.Component {
  constructor(){
    super();
    this.state = {
      feeds : settingsStore.getFeeds(), 
      currentFeed : settingsStore.getCurrentFeed(),
      navExpanded : false
    };
  }

  _changeLoc = (event) => {
    SettingsActions.changeFeed(event.target.id);
  }

  updateFeed = () => {
    this.setState(_.extend({}, this.state, {
      currentFeed : settingsStore.getCurrentFeed(),
      navExpanded : !this.state.navExpanded
    }))
  }

  componentWillMount(){
    settingsStore.on('change', this.updateFeed);
  }

  updateSearch = (e) => {
    this.props.changeSearchTerm(e.target.value)
  }

  expandToggle = () => {
    this.setState(_.extend({}, this.state, {
      navExpanded : !this.state.navExpanded
    }))
  }

  render() {    
    return (
      <BS.Navbar 
        style={{zIndex : 3}} 
        expanded={this.state.navExpanded} 
        onToggle={this.expandToggle}
      >
        <BS.Navbar.Header>
          <BS.Navbar.Toggle/>
        </BS.Navbar.Header>
        <BS.Navbar.Collapse>
          <BS.Nav>
            <BS.NavDropdown eventKey={1} title="Choose Location" id="loc-dropdown">
              {
                Object.keys(this.state.feeds).map((feed) => 
                  <BS.MenuItem 
                                id={feed} 
                                key={feed} 
                                onClick={this._changeLoc} 
                                active={feed == this.state.currentFeed}
                  >
                    {this.state.feeds[feed].name}
                  </BS.MenuItem>
                )
              }
            </BS.NavDropdown>
            <LinkContainer to="/the_feed">
              <BS.NavItem eventKey={2} onClick={this.expandToggle}>
                List View
              </BS.NavItem>
            </LinkContainer>
            <LinkContainer to="map">
              <BS.NavItem eventKey={3} onClick={this.expandToggle}>
                Map View
              </BS.NavItem>
            </LinkContainer>
            <LinkContainer to="about">
              <BS.NavItem eventKey={4} onClick={this.expandToggle}>
                About
              </BS.NavItem>
            </LinkContainer>
            <LinkContainer to="stats">
              <BS.NavItem eventKey={5} onClick={this.expandToggle}>
                Stats
              </BS.NavItem>
            </LinkContainer>
          </BS.Nav>
          {
            this.props.location.pathname === '/the_feed' ? 
              <BS.Navbar.Form>
                <BS.FormControl
                  type="text"
                  value={this.props.searchTerm}
                  placeholder="Filter"
                  onChange={this.updateSearch}
                />
              </BS.Navbar.Form> : null
          }
        </BS.Navbar.Collapse>
      </BS.Navbar>
    );
  }
}

const mapStateToProps = state => ({
  searchTerm : state.search.searchTerm
});

const mapDispatchToProps = dispatch => ({
  changeSearchTerm : term => dispatch(SearchActions.changeSearchTerm(term))
});

export default connect(mapStateToProps, mapDispatchToProps)(Nav);



